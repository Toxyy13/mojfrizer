import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { matchesQuery } from "./searchText";
import { db, systemDb } from "./db";
import { PUBLIC_SALONS, canViewSalon, isSalonRole } from "./salonVisibility";
import { getSessionUser } from "./auth";
import { getAvailableSlots } from "./booking";
import { hhmmToMinutes } from "./salonSettings";
import { prepareAction, signProposal, type ActionContext, type AssistantAction } from "./assistantActions";
import { appointmentWhenFormat } from "./manageBooking";
import { appointmentServicesInclude, servicesLabel } from "./visit";
import { formatRsd, formatServicePrice } from "./money";
import { fullAddress } from "./salonAddress";
import { TIME_ZONE, WEEKDAYS_SR, addDaysIso, formatDateSr, formatLocalTime, isValidDateIso, isoWeekdayOf, localToUtc, minutesToHHMM, todayIso } from "./time";

// "Todor", the assistant (text and voice). It answers from the platform's own data. Changes (booking, prices, hours...)
// are only PROPOSED by the model; the person confirms on screen and assistantActions.ts runs them with the normal checks.

// Haiku keeps the per-salon cost negligible (Todor chose it, 2026-10-12).
const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_TOOL_ROUNDS = 4;
const MAX_OUTPUT_TOKENS = 1024;
const SLOT_LOOKAHEAD_DAYS = 30;

export const assistantRequestSchema = z.object({
  slug: z.string().max(80).optional(),
  // Opened from the salon admin panel: the salon owner's assistant (checked against the login, never trusted).
  admin: z.boolean().optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(12)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", "Razgovor mora početi i završiti se pitanjem"),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export interface PendingAction {
  token: string;
  summary: string;
}

export type AssistantResult = { ok: true; reply: string; pending?: PendingAction } | { ok: false; status: number; error: string };

const BASE_RULES = `Ti si Todor, asistent platforme mojfrizer.com (mušterija ti piše ili govori, a odgovor može da se čita naglas). Mušterije preko platforme nalaze frizerske salone u Srbiji i zakazuju termine online.
Pravila:
- Odgovaraj na srpskom (latinica), kratko i ljubazno: najviše 3-4 rečenice. Bez emotikona, bez markdown-a i tabela. Vreme piši kao 14:30, bez ID-jeva.
- Koristi samo podatke iz ovog uputstva i rezultate alata. Ako nešto ne znaš, reci da to nemaš i predloži poziv ili poruku salonu.
- Ne izmišljaj cene, termine, usluge ni radno vreme. Za slobodne termine uvek pozovi alat; nikad ne pogađaj.
- Ne pitaj za lične podatke koje već imaš. Ne daj medicinske savete.
- Ako pitanje nema veze sa frizerima, salonima ili zakazivanjem, ljubazno vrati razgovor na tu temu.
- Linkove na salone piši kao /s/naziv-salona.
- Radnje (zakazivanje, otkazivanje, izmene) radiš samo alatima „propose_…”. Alat samo PRIPREMA radnju: korisnik je potvrđuje dugmetom na ekranu. Posle poziva reci jednom rečenicom šta si pripremio i da potvrdi na ekranu. Nikad ne tvrdi da je nešto već urađeno. Pre predloga proveri slobodan termin alatom i pitaj za ono što fali (usluga, dan, vreme).`;

const GUEST_RULES = `- Ti ne možeš da zakažeš termin ovom posetiocu jer nije prijavljen. Reci mu da se prijavi (/prijava) ili da zakaže na stranici salona dugmetom „Zakaži termin”, i ponudi slobodna vremena koja si našao.`;

const CLIENT_RULES = `- Prijavljena mušterija može da ti kaže da joj zakažeš, otkažeš ili pomeriš termin u ovom salonu. Njene termine vidiš alatom my_appointments. Radiš samo za nju.`;

const OWNER_RULES = `- Razgovaraš sa vlasnikom salona, u njegovom admin panelu. Pomažeš oko rasporeda, zarade, hitnih zahteva i podešavanja: upis, otkazivanje i pomeranje termina, cene i trajanje usluga, radno vreme, neradni dani i pauze. Za termine i zaradu koristi alate za čitanje; ne pogađaj.
- Cene izgovaraj u dinarima. Kada vlasnik kaže ime mušterije, nađi termin u rasporedu tog dana.`;

const PLATFORM_FACTS = `Kako radi platforma:
- Termin se zakazuje na stranici salona: izabere se jedna ili više usluga (npr. šišanje i pranje u istom terminu), dan i slobodno vreme, pa se upiše ime i telefon (ili se prijavi nalogom).
- Mušterija sa nalogom vidi svoje termine na stranici „Moj nalog”, može da označi omiljeni salon i da piše salonu poruke.
- Podsetnik za termin stiže emailom (ne SMS-om) mušterijama koje imaju nalog sa emailom.
- Ako je dan potpuno popunjen, može se poslati hitan zahtev; salon tada pokušava da nađe zamenu.
- Otkazivanje: najjednostavnije je pozvati salon ili mu poslati poruku.`;

type SalonWithData = NonNullable<Awaited<ReturnType<typeof loadSalon>>>;

async function loadSalon(slug: string) {
  return db.salon.findFirst({
    where: { slug, isActive: true },
    include: {
      workingHours: { orderBy: [{ dayOfWeek: "asc" }, { opensAt: "asc" }] },
      daysOff: { where: { date: { gte: new Date(`${todayIso(TIME_ZONE)}T00:00:00Z`) } }, orderBy: { date: "asc" }, take: 20 },
      services: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      workers: { where: { isActive: true }, orderBy: { displayName: "asc" } },
      serviceCombos: true,
    },
  });
}

function describeSalon(salon: SalonWithData, forOwner: boolean): string {
  const hours = [1, 2, 3, 4, 5, 6, 7]
    .map((wd) => {
      const ranges = salon.workingHours.filter((h) => h.dayOfWeek === wd);
      const text = ranges.length
        ? ranges.map((r) => `${minutesToHHMM(r.opensAt)}-${minutesToHHMM(r.closesAt)}`).join(", ")
        : "zatvoreno";
      return `- ${WEEKDAYS_SR[wd]}: ${text}`;
    })
    .join("\n");
  const services = salon.services
    .map((s) => `- id=${s.id} | ${s.name}${s.category ? ` (${s.category})` : ""} | ${formatServicePrice(s)} | ${s.durationMinutes} min${s.description ? ` | ${s.description}` : ""}`)
    .join("\n");
  const combos = salon.serviceCombos
    .map((c) => {
      const names = salon.services.filter((s) => c.serviceIds.includes(s.id)).map((s) => s.name);
      return names.length === c.serviceIds.length ? `- ${names.join(" + ")}: ${c.durationMinutes} min` : null;
    })
    .filter((line): line is string => line !== null);
  const daysOff = salon.daysOff.length
    ? salon.daysOff.map((d) => `- ${formatDateSr(d.date.toISOString().slice(0, 10))}${d.reason ? ` (${d.reason})` : ""}`).join("\n")
    : "- nema najavljenih neradnih dana";

  const workers = salon.workers.map((w) => (forOwner ? `${w.displayName} (id=${w.id})` : w.displayName)).join(", ") || "nije upisano";
  return `${forOwner ? "Vlasnik je u admin panelu svog salona" : "Mušterija je na stranici salona. Odgovaraš u ime ovog salona"}:
Naziv: ${salon.name}
Stranica: /s/${salon.slug}
Adresa: ${fullAddress(salon)}
Telefon: ${salon.phone ?? "nije upisan (mušterija može da pošalje poruku salonu preko stranice)"}
${salon.description ? `Opis: ${salon.description}\n` : ""}Frizeri: ${workers}

Radno vreme:
${hours}

Neradni dani:
${daysOff}

Usluge i cene (id koristi samo za alat, ne pokazuj ga mušteriji):
${services}

Više usluga može u jednom terminu. Trajanje zajedno:
${combos.length ? combos.join("\n") : "- (nije posebno podešeno)"}
- ostale kombinacije: zbir trajanja usluga`;
}

const SALON_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "find_free_slots",
    description:
      "Vraća slobodna vremena za online zakazivanje za jednu ili više usluga ovog salona (u istom terminu) na jedan dan. Koristi kad mušterija pita da li ima mesta, kad može da dođe ili za konkretan dan.",
    input_schema: {
      type: "object",
      properties: {
        service_ids: {
          type: "array",
          items: { type: "string" },
          description: "id-jevi usluga iz cenovnika koje mušterija želi u istom terminu",
        },
        date: { type: "string", description: "Datum u formatu YYYY-MM-DD" },
      },
      required: ["service_ids", "date"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const PLATFORM_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_salons",
    description: "Traži salone na platformi po nazivu, gradu ili ulici. Vraća naziv, adresu i link.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Grad, naziv salona ili ulica, npr. Niš" } },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
];

type Mode = "guest" | "client" | "owner";

const str = (description: string): { type: "string"; description: string } => ({ type: "string", description });
const DATE = str("Datum YYYY-MM-DD");
const TIME = str("Vreme HH:MM");

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[]): Anthropic.Beta.BetaTool {
  return { name, description, input_schema: { type: "object", properties, required, additionalProperties: false } } as Anthropic.Beta.BetaTool;
}

const BOOKING = { service_ids: { type: "array", items: { type: "string" }, description: "id-jevi usluga" }, date: DATE, time: TIME };
const MOVE = tool("propose_move", "Priprema pomeranje termina na drugi slobodan dan i vreme (potvrđuje se na ekranu).", { appointment_id: str("id termina"), date: DATE, time: TIME }, ["appointment_id", "date", "time"]);

const CLIENT_TOOLS = [
  tool("my_appointments", "Vraća predstojeće termine prijavljene mušterije (sa id-jem).", {}, []),
  tool("propose_booking", "Priprema zakazivanje termina u ovom salonu (potvrđuje se na ekranu). Prvo proveri slobodno vreme.", BOOKING, ["service_ids", "date", "time"]),
  tool("propose_cancel", "Priprema otkazivanje termina mušterije (potvrđuje se na ekranu).", { appointment_id: str("id termina") }, ["appointment_id"]),
  MOVE,
];

const OWNER_TOOLS = [
  tool("get_schedule", "Raspored za jedan dan: termini sa id-jem, vremenom, mušterijom, telefonom, uslugom, cenom i statusom.", { date: DATE }, ["date"]),
  tool("get_urgent_requests", "Otvoreni hitni zahtevi mušterija.", {}, []),
  tool("get_earnings", "Zarada (završeni termini) i očekivana zarada (zakazani) u periodu.", { from: DATE, to: DATE }, ["from", "to"]),
  tool("propose_booking", "Priprema upis termina za mušteriju (potvrđuje se na ekranu). Prvo proveri slobodno vreme.", { ...BOOKING, client_name: str("Ime mušterije"), client_phone: str("Telefon, ako ga ima"), worker_id: str("id frizera, ako je traženo") }, ["service_ids", "date", "time", "client_name"]),
  tool("propose_cancel", "Priprema otkazivanje termina (potvrđuje se na ekranu).", { appointment_id: str("id termina") }, ["appointment_id"]),
  tool("propose_complete", "Priprema oznaku termina kao završen ili kao „nije došao”.", { appointment_id: str("id termina"), status: { type: "string", enum: ["COMPLETED", "NO_SHOW"] } }, ["appointment_id", "status"]),
  MOVE,
  tool("propose_service_change", "Priprema izmenu usluge: cena u dinarima, trajanje u minutima ili skrivanje/vraćanje u cenovnik.", { service_id: str("id usluge"), price_rsd: { type: "number" }, duration_minutes: { type: "integer" }, active: { type: "boolean" } }, ["service_id"]),
  tool("propose_working_hours", "Priprema radno vreme za jedan dan u nedelji (1=ponedeljak ... 7=nedelja). Bez opens/closes salon taj dan ne radi.", { weekday: { type: "integer" }, opens: TIME, closes: TIME }, ["weekday"]),
  tool("propose_days_off", "Priprema neradni dan ili odmor (od-do).", { from: DATE, to: DATE, reason: str("Razlog") }, ["from"]),
  tool("propose_break", "Priprema pauzu frizera: ili dani u nedelji (1-7) ili jedan datum.", { worker_id: str("id frizera"), from_time: TIME, to_time: TIME, weekdays: { type: "array", items: { type: "integer" } }, date: DATE, label: str("Naziv pauze") }, ["worker_id", "from_time", "to_time"]),
];

/** Turns the model's tool input into the raw action the server validates (prepareAction). */
function toAction(name: string, i: Record<string, unknown>, mode: Mode): Record<string, unknown> {
  const owner = mode === "owner";
  const time = (v: unknown): number | null => (typeof v === "string" ? hhmmToMinutes(v) : null);
  switch (name) {
    case "propose_booking":
      return { type: owner ? "salon_book" : "book", serviceIds: i.service_ids, dateIso: i.date, minute: time(i.time), clientName: i.client_name, clientPhone: i.client_phone || null, workerId: i.worker_id || null };
    case "propose_cancel":
      return owner ? { type: "salon_status", appointmentId: i.appointment_id, status: "CANCELLED" } : { type: "cancel_mine", appointmentId: i.appointment_id };
    case "propose_complete":
      return { type: "salon_status", appointmentId: i.appointment_id, status: i.status };
    case "propose_move":
      return { type: owner ? "salon_move" : "move_mine", appointmentId: i.appointment_id, dateIso: i.date, minute: time(i.time) };
    case "propose_service_change":
      return { type: "set_service", serviceId: i.service_id, priceRsd: i.price_rsd, durationMinutes: i.duration_minutes, active: i.active };
    case "propose_working_hours":
      return { type: "set_hours", weekday: i.weekday, opensAt: time(i.opens), closesAt: time(i.closes) };
    case "propose_days_off":
      return { type: "add_days_off", from: i.from, to: i.to || undefined, reason: i.reason || undefined };
    case "propose_break":
      return { type: "add_break", workerId: i.worker_id, startMinute: time(i.from_time), endMinute: time(i.to_time), weekdays: i.weekdays, dateIso: i.date || undefined, label: i.label || undefined };
    default:
      return { type: "unknown" };
  }
}

const dayRange = (dateStr: string): { gte: Date; lt: Date } => ({ gte: localToUtc(dateStr, 0, TIME_ZONE), lt: localToUtc(addDaysIso(dateStr, 1), 0, TIME_ZONE) });

async function myAppointments(userId: string): Promise<string> {
  const rows = await systemDb.appointment.findMany({
    where: { clientId: userId, status: "BOOKED", startTime: { gt: new Date() } },
    include: { ...appointmentServicesInclude, service: true, salon: { select: { name: true } } },
    orderBy: { startTime: "asc" },
    take: 10,
  });
  if (rows.length === 0) return "Nema predstojećih termina.";
  return rows.map((a) => `- id=${a.id} | ${a.salon.name}, ${appointmentWhenFormat.format(a.startTime)}, ${servicesLabel(a)}`).join("\n");
}

async function getSchedule(salonId: string, input: Record<string, unknown>): Promise<string> {
  const date = typeof input.date === "string" ? input.date : "";
  if (!isValidDateIso(date)) return "Neispravan datum.";
  const rows = await db.appointment.findMany({
    where: { salonId, startTime: dayRange(date) },
    include: { ...appointmentServicesInclude, service: true, worker: { select: { displayName: true } }, client: { select: { name: true, phone: true } } },
    orderBy: { startTime: "asc" },
  });
  if (rows.length === 0) return `${formatDateSr(date)}: nema termina.`;
  const lines = rows.map((a) => {
    const who = a.guestName ?? a.client?.name ?? "mušterija";
    const phone = a.guestPhone ?? a.client?.phone ?? "bez telefona";
    return `- id=${a.id} | ${formatLocalTime(a.startTime, TIME_ZONE)}-${formatLocalTime(a.endTime, TIME_ZONE)} | ${who} | ${phone} | ${servicesLabel(a)} | ${formatRsd(a.price)} | ${a.status} | ${a.worker.displayName}`;
  });
  return `${formatDateSr(date)}:\n${lines.join("\n")}`;
}

async function getUrgentRequests(salonId: string): Promise<string> {
  const rows = await db.urgentRequest.findMany({ where: { salonId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 10 });
  if (rows.length === 0) return "Nema otvorenih hitnih zahteva.";
  return rows
    .map((r) => `- ${r.guestName}, ${r.guestPhone}, za ${formatDateSr(r.date.toISOString().slice(0, 10))}${r.timeWish ? ` (${r.timeWish})` : ""}: ${r.reason}`)
    .join("\n");
}

async function getEarnings(salonId: string, input: Record<string, unknown>): Promise<string> {
  const from = typeof input.from === "string" ? input.from : "";
  const to = typeof input.to === "string" ? input.to : "";
  if (!isValidDateIso(from) || !isValidDateIso(to) || to < from) return "Neispravan period.";
  const range = { gte: localToUtc(from, 0, TIME_ZONE), lt: localToUtc(addDaysIso(to, 1), 0, TIME_ZONE) };
  const sum = (status: "COMPLETED" | "BOOKED") =>
    db.appointment.aggregate({ where: { salonId, status, startTime: range }, _sum: { price: true }, _count: true });
  const [done, booked] = await Promise.all([sum("COMPLETED"), sum("BOOKED")]);
  return `Od ${formatDateSr(from)} do ${formatDateSr(to)}: završeno ${done._count} termina, ${formatRsd(done._sum.price ?? 0)}; zakazano još ${booked._count} termina, ${formatRsd(booked._sum.price ?? 0)}.`;
}

async function findFreeSlots(salon: SalonWithData, input: Record<string, unknown>): Promise<string> {
  const serviceIds = Array.isArray(input.service_ids)
    ? input.service_ids.filter((id): id is string => typeof id === "string")
    : [];
  const date = typeof input.date === "string" ? input.date : "";
  const chosen = salon.services.filter((s) => serviceIds.includes(s.id));
  if (chosen.length === 0 || chosen.length !== new Set(serviceIds).size) {
    return "Nepoznata usluga. Koristi id iz cenovnika.";
  }
  const label = chosen.map((s) => s.name).join(" + ");
  const today = todayIso(TIME_ZONE);
  if (!isValidDateIso(date) || date < today || date > addDaysIso(today, SLOT_LOOKAHEAD_DAYS)) {
    return `Datum mora biti između ${today} i ${addDaysIso(today, SLOT_LOOKAHEAD_DAYS)}.`;
  }
  const slots = await getAvailableSlots({
    salonId: salon.id,
    serviceIds: chosen.map((s) => s.id),
    dateIso: date,
    enforceLeadTime: true,
  });
  const day = formatDateSr(date);
  if (slots.length === 0) return `${day}: nema slobodnih termina za „${label}” (salon ne radi ili je sve zauzeto).`;
  return `${day}, „${label}”: slobodno u ${slots.map((s) => minutesToHHMM(s.minute)).join(", ")}.`;
}

async function searchSalons(input: Record<string, unknown>): Promise<string> {
  const query = typeof input.query === "string" ? input.query.trim().slice(0, 60) : "";
  const found = await db.salon.findMany({
    where: { isActive: true, ...PUBLIC_SALONS },
    orderBy: { name: "asc" },
    select: { name: true, slug: true, city: true, address: true },
    ...(query ? {} : { take: 10 }),
  });
  const salons = (query ? found.filter((s) => matchesQuery(query, s.name, s.city, s.address)) : found).slice(0, 10);
  if (salons.length === 0) return `Nema salona za „${query}”.`;
  return salons.map((s) => `- ${s.name}, ${fullAddress(s)}, /s/${s.slug}`).join("\n");
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function answerQuestion(request: AssistantRequest): Promise<AssistantResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, status: 503, error: "Asistent još nije uključen. Pozovite salon ili pošaljite poruku." };
  }

  const asker = await getSessionUser();
  let salon: SalonWithData | null = null;
  let mode: Mode = "guest";
  if (request.admin) {
    // The owner's assistant: only for the owner of this very salon, whatever the browser claims.
    if (!asker || !request.slug) return { ok: false, status: 403, error: "Zabranjeno." };
    const owned = await loadSalon(request.slug);
    if (!owned || owned.ownerId !== asker.id) return { ok: false, status: 403, error: "Zabranjeno." };
    salon = owned;
    mode = "owner";
  } else {
    // Salon logins get no platform-wide salon search; with a slug, canViewSalon limits them to their own salon.
    if (isSalonRole(asker?.role) && !request.slug) return { ok: false, status: 403, error: "Zabranjeno." };
    const found = request.slug ? await loadSalon(request.slug) : null;
    // A private salon is invisible to the assistant unless this visitor may open it.
    salon = found && (await canViewSalon(found.id, asker)) ? found : null;
    if (request.slug && !salon) return { ok: false, status: 404, error: "Salon nije pronađen" };
    if (salon && asker?.role === "CLIENT") mode = "client";
  }

  const today = todayIso(TIME_ZONE);
  const context = salon
    ? describeSalon(salon, mode === "owner")
    : "Mušterija je na početnoj stranici platforme i još nije izabrala salon. Pomozi joj da nađe salon (alat search_salons) i objasni kako se zakazuje. Zakazivanje radi samo na stranici salona.";
  const rules = mode === "owner" ? OWNER_RULES : mode === "client" ? CLIENT_RULES : GUEST_RULES;
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: `${BASE_RULES}\n${rules}\n\n${PLATFORM_FACTS}` },
    // Salon data and date change rarely, so this prefix is cached across questions.
    { type: "text", text: `${context}\n\nDanas je ${WEEKDAYS_SR[isoWeekdayOf(today)]}, ${today}.`, cache_control: { type: "ephemeral" } },
  ];
  const free = SALON_TOOLS;
  const tools = !salon ? PLATFORM_TOOLS : mode === "owner" ? [...free, ...OWNER_TOOLS] : mode === "client" ? [...free, ...CLIENT_TOOLS] : free;
  const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map((m) => ({ role: m.role, content: m.content }));
  const actionCtx: ActionContext | null = salon && asker ? { user: asker, salon: { id: salon.id, slug: salon.slug, name: salon.name } } : null;
  let pending: { action: AssistantAction; summary: string } | null = null;

  const model = process.env.ASSISTANT_MODEL || DEFAULT_MODEL;
  // Server-side fallback on a refusal is offered for Opus/Fable, not for Haiku.
  const fallback = model.startsWith("claude-opus") || model.startsWith("claude-fable");
  const client = new Anthropic();

  async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
    if (name === "search_salons") return searchSalons(input);
    if (!salon) return "Nepoznat alat.";
    if (name === "find_free_slots") return findFreeSlots(salon, input);
    if (mode === "client" && name === "my_appointments" && asker) return myAppointments(asker.id);
    if (mode === "owner" && name === "get_schedule") return getSchedule(salon.id, input);
    if (mode === "owner" && name === "get_urgent_requests") return getUrgentRequests(salon.id);
    if (mode === "owner" && name === "get_earnings") return getEarnings(salon.id, input);
    if (name.startsWith("propose_") && actionCtx && mode !== "guest") {
      const prepared = await prepareAction(actionCtx, toAction(name, input, mode), mode === "owner");
      if (!prepared.ok) return `Ne može: ${prepared.error}`;
      pending = prepared;
      return "Predlog je prikazan na ekranu sa dugmadima Potvrdi i Odustani. Reci korisniku da potvrdi na ekranu. Nije još urađeno.";
    }
    return "Nepoznat alat.";
  }

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        output_config: { effort: "low" },
        system,
        tools,
        messages,
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });

      if (response.stop_reason === "refusal") {
        return { ok: true, reply: "Na ovo pitanje ne mogu da odgovorim. Pitajte me nešto o salonu, cenama ili terminima." };
      }
      if (response.stop_reason !== "tool_use") {
        const reply = textOf(response.content) || "Izvinite, nisam razumeo pitanje. Možete li ga postaviti drugačije?";
        const proposal = pending as { action: AssistantAction; summary: string } | null;
        if (proposal && actionCtx) return { ok: true, reply, pending: { token: await signProposal(actionCtx, proposal.action), summary: proposal.summary } };
        return { ok: true, reply };
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const output = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>);
        results.push({ type: "tool_result", tool_use_id: block.id, content: output });
      }
      messages.push({ role: "user", content: results });
    }
    return { ok: true, reply: "Izvinite, ovo mi je trebalo predugo. Pokušajte konkretnije pitanje, npr. „Ima li slobodno u subotu za šišanje?”" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, status: 429, error: "Asistent je trenutno zauzet. Pokušajte za minut." };
    }
    console.error("assistant error", error);
    return { ok: false, status: 502, error: "Asistent trenutno ne radi. Pozovite salon ili pošaljite poruku." };
  }
}

/** Counts one answered question for the developer's usage statistics. Never fails the answer. */
export async function recordAssistantUse(slug: string | null | undefined): Promise<void> {
  try {
    const salon = slug ? await systemDb.salon.findUnique({ where: { slug }, select: { id: true } }) : null;
    await systemDb.assistantUse.create({ data: { salonId: salon?.id ?? null } });
  } catch (error) {
    console.error("assistant usage log failed", error);
  }
}
