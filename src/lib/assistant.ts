import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { matchesQuery } from "./searchText";
import { db, systemDb } from "./db";
import { PUBLIC_SALONS, canViewSalon } from "./salonVisibility";
import { getSessionUser } from "./auth";
import { getAvailableSlots } from "./booking";
import { formatServicePrice } from "./money";
import { fullAddress } from "./salonAddress";
import { TIME_ZONE, WEEKDAYS_SR, addDaysIso, formatDateSr, isValidDateIso, isoWeekdayOf, minutesToHHMM, todayIso } from "./time";

// AI assistant that answers customer questions from the platform's own data.
// First version only answers and points to booking; it never books by itself.

// Haiku keeps the per-salon cost negligible (Todor chose it, 2026-10-12).
const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_TOOL_ROUNDS = 4;
const MAX_OUTPUT_TOKENS = 1024;
const SLOT_LOOKAHEAD_DAYS = 30;

export const assistantRequestSchema = z.object({
  slug: z.string().max(80).optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(12)
    .refine((m) => m[0].role === "user" && m[m.length - 1].role === "user", "Razgovor mora početi i završiti se pitanjem"),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export type AssistantResult = { ok: true; reply: string } | { ok: false; status: number; error: string };

const BASE_RULES = `Ti si AI asistent platforme mojfrizer.com, gde mušterije pronalaze frizerske salone u Srbiji i zakazuju termine online.
Pravila:
- Odgovaraj na srpskom (latinica), kratko i ljubazno: najviše 3-4 rečenice ili kratka lista.
- Koristi samo podatke iz ovog uputstva i rezultate alata. Ako nešto ne znaš (npr. vrsta preparata, parking), reci da to nemaš i predloži da mušterija pozove salon ili pošalje poruku salonu.
- Ne izmišljaj cene, termine, usluge ni radno vreme.
- Ti ne možeš sam da zakažeš termin. Kada mušterija želi termin, reci joj da ga zakaže na stranici salona (dugme „Zakaži termin”) i ponudi slobodna vremena koja si našao.
- Za slobodne termine uvek pozovi alat; nikad ne pogađaj.
- Ne pitaj za lične podatke (telefon, email). Ne daj medicinske savete.
- Ako pitanje nema veze sa frizerima, salonima ili zakazivanjem, ljubazno vrati razgovor na tu temu.
- Piši običan tekst bez markdown naslova i tabela. Linkove na salone piši kao /s/naziv-salona.`;

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

function describeSalon(salon: SalonWithData): string {
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

  return `Mušterija je na stranici salona. Odgovaraš u ime ovog salona:
Naziv: ${salon.name}
Stranica: /s/${salon.slug}
Adresa: ${fullAddress(salon)}
Telefon: ${salon.phone ?? "nije upisan (mušterija može da pošalje poruku salonu preko stranice)"}
${salon.description ? `Opis: ${salon.description}\n` : ""}Frizeri: ${salon.workers.map((w) => w.displayName).join(", ") || "nije upisano"}

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

  const found = request.slug ? await loadSalon(request.slug) : null;
  // A private salon is invisible to the assistant unless this visitor may open it.
  const salon = found && (await canViewSalon(found.id, await getSessionUser())) ? found : null;
  if (request.slug && !salon) return { ok: false, status: 404, error: "Salon nije pronađen" };

  const today = todayIso(TIME_ZONE);
  const context = salon ? describeSalon(salon) : "Mušterija je na početnoj stranici platforme i još nije izabrala salon. Pomozi joj da nađe salon (alat search_salons) i objasni kako se zakazuje.";
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: `${BASE_RULES}\n\n${PLATFORM_FACTS}` },
    // Salon data and date change rarely, so this prefix is cached across questions.
    { type: "text", text: `${context}\n\nDanas je ${WEEKDAYS_SR[isoWeekdayOf(today)]}, ${today}.`, cache_control: { type: "ephemeral" } },
  ];
  const tools = salon ? SALON_TOOLS : PLATFORM_TOOLS;
  const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map((m) => ({ role: m.role, content: m.content }));

  const model = process.env.ASSISTANT_MODEL || DEFAULT_MODEL;
  // Server-side fallback on a refusal is offered for Opus/Fable, not for Haiku.
  const fallback = model.startsWith("claude-opus") || model.startsWith("claude-fable");
  const client = new Anthropic();

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
        return { ok: true, reply: textOf(response.content) || "Izvinite, nisam razumeo pitanje. Možete li ga postaviti drugačije?" };
      }

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const input = (block.input ?? {}) as Record<string, unknown>;
        let output: string;
        if (block.name === "find_free_slots" && salon) output = await findFreeSlots(salon, input);
        else if (block.name === "search_salons") output = await searchSalons(input);
        else output = "Nepoznat alat.";
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
