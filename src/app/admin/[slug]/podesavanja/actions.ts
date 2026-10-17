"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, systemDb } from "@/lib/db";
import { requireSalonOwner } from "@/lib/access";
import { appointmentsInBreak } from "@/lib/breaks";
import { rsdToPara } from "@/lib/money";
import { MAX_PASSWORD_LENGTH, hashPassword } from "@/lib/auth";
import { consume } from "@/lib/rateLimit";
import { formatPhone, looksLikeEmail, normalizePhone } from "@/lib/phone";
import {
  MAX_DAYS_OFF_RANGE,
  dayOffSchema,
  hhmmToMinutes,
  parseWeeklyHours,
  readServiceForm,
  salonInfoSchema,
} from "@/lib/salonSettings";
import { TIME_ZONE, WEEKDAYS_SR, addDaysIso, formatLocalDateIso, formatLocalTime, isValidDateIso, localToUtc } from "@/lib/time";
import { MAX_SERVICES_PER_VISIT } from "@/lib/visit";

// Each action redirects back with ?ok= or ?greska= so the page can show the outcome without client JS.
function back(slug: string, section: string, outcome: { ok: string } | { error: string }): never {
  const params = new URLSearchParams("ok" in outcome ? { ok: outcome.ok } : { greska: outcome.error });
  redirect(`/admin/${slug}/podesavanja?${params.toString()}#${section}`);
}

function refresh(slug: string): void {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/s/${slug}`);
}

function done(slug: string, section: string, ok: string): never {
  refresh(slug);
  back(slug, section, { ok });
}

export async function saveSalonInfo(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const parsed = salonInfoSchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    address: formData.get("address") ?? "",
    city: formData.get("city") ?? "",
    phone: formData.get("phone") ?? "",
    slotStepMinutes: formData.get("slotStepMinutes") ?? "",
    cancelCutoffHours: formData.get("cancelCutoffHours") ?? "",
    urgentSurchargeRsd: formData.get("urgentSurchargeRsd") || 0,
  });
  if (!parsed.success) back(slug, "salon", { error: parsed.error.issues[0]?.message ?? "Neispravni podaci" });
  const { phone: rawPhone, description, urgentSurchargeRsd, ...rest } = parsed.data;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) back(slug, "salon", { error: "Broj telefona nije ispravan, npr. 018 123 456." });
  try {
    await db.salon.update({
      where: { id: salon.id },
      data: { ...rest, urgentSurcharge: rsdToPara(urgentSurchargeRsd), description: description || null, phone: phone ? formatPhone(phone) : null },
    });
  } catch (error) {
    console.error(error);
    back(slug, "salon", { error: "Čuvanje nije uspelo." });
  }
  done(slug, "salon", "Podaci o salonu su sačuvani.");
}

export async function saveVisibility(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const visibility = formData.get("visibility");
  if (visibility !== "PUBLIC" && visibility !== "PRIVATE") back(slug, "vidljivost", { error: "Izaberite javni ili privatni salon." });
  try {
    await db.salon.update({ where: { id: salon.id }, data: { visibility } });
  } catch (error) {
    console.error(error);
    back(slug, "vidljivost", { error: "Čuvanje nije uspelo." });
  }
  revalidatePath("/");
  done(slug, "vidljivost", visibility === "PRIVATE" ? "Salon je sada privatan." : "Salon je sada javan.");
}

export async function saveService(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const id = String(formData.get("id") ?? "");
  const parsed = readServiceForm(formData);
  if (!parsed.success) back(slug, "usluge", { error: parsed.error.issues[0]?.message ?? "Neispravni podaci" });
  const f = parsed.data;
  const data = {
    name: f.name,
    category: f.category || null,
    description: f.description || null,
    price: rsdToPara(f.priceRsd),
    comboPrice: f.comboPriceRsd === "" ? null : rsdToPara(f.comboPriceRsd),
    durationMinutes: f.durationMinutes,
    sortOrder: f.sortOrder,
  };
  let saved = true;
  try {
    if (id) {
      // salonId in the filter keeps one tenant from editing another tenant's service.
      const { count } = await db.service.updateMany({ where: { id, salonId: salon.id }, data });
      saved = count > 0;
    } else {
      await db.service.create({ data: { ...data, salonId: salon.id } });
    }
  } catch (error) {
    console.error(error);
    saved = false;
  }
  if (!saved) back(slug, "usluge", { error: "Čuvanje usluge nije uspelo." });
  done(slug, "usluge", id ? `Usluga „${f.name}" je izmenjena.` : `Usluga „${f.name}" je dodata.`);
}

/** Hides or shows a service. Services are never deleted because past appointments point to them. */
export async function toggleService(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  await db.service.updateMany({ where: { id, salonId: salon.id }, data: { isActive } });
  done(slug, "usluge", isActive ? "Usluga je ponovo u cenovniku." : "Usluga je sklonjena iz cenovnika.");
}

export async function saveWorkingHours(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const result = parseWeeklyHours(formData, WEEKDAYS_SR);
  if (!result.ok) back(slug, "radno-vreme", { error: result.error });
  try {
    await db.$transaction([
      db.workingHours.deleteMany({ where: { salonId: salon.id } }),
      db.workingHours.createMany({ data: result.ranges.map((r) => ({ ...r, salonId: salon.id })) }),
    ]);
  } catch (error) {
    console.error(error);
    back(slug, "radno-vreme", { error: "Čuvanje radnog vremena nije uspelo." });
  }
  done(slug, "radno-vreme", "Radno vreme je sačuvano. Već zakazani termini ostaju.");
}

export async function addDaysOff(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const parsed = dayOffSchema.safeParse({
    from: formData.get("from") ?? "",
    to: formData.get("to") ?? "",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success || !isValidDateIso(parsed.data.from)) back(slug, "neradni-dani", { error: "Izaberite datum." });
  const { from, reason } = parsed.data;
  const to = parsed.data.to || from;
  if (!isValidDateIso(to) || to < from) back(slug, "neradni-dani", { error: "Kraj odmora mora biti posle početka." });

  const dates: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) {
    dates.push(d);
    if (dates.length > MAX_DAYS_OFF_RANGE) {
      back(slug, "neradni-dani", { error: `Najviše ${MAX_DAYS_OFF_RANGE} dana odjednom.` });
    }
  }
  await db.salonDayOff.createMany({
    data: dates.map((d) => ({ salonId: salon.id, date: new Date(`${d}T00:00:00Z`), reason: reason || null })),
    skipDuplicates: true,
  });
  refresh(slug);
  const booked = await db.appointment.count({
    where: {
      salonId: salon.id,
      status: "BOOKED",
      startTime: { gte: new Date(`${from}T00:00:00Z`), lt: new Date(`${addDaysIso(to, 1)}T00:00:00Z`) },
    },
  });
  back(slug, "neradni-dani", {
    ok:
      booked > 0
        ? `Dodato. Pažnja: tih dana već ima ${booked} zakazanih termina, javite se tim mušterijama.`
        : dates.length > 1
          ? `Dodato ${dates.length} neradnih dana.`
          : "Neradni dan je dodat.",
  });
}

export async function removeDayOff(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  await db.salonDayOff.deleteMany({ where: { id: String(formData.get("id") ?? ""), salonId: salon.id } });
  done(slug, "neradni-dani", "Neradni dan je uklonjen.");
}

export async function saveWorker(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const id = String(formData.get("id") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const specialities = String(formData.get("specialities") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (displayName.length < 2 || displayName.length > 60) back(slug, "radnici", { error: "Upišite ime radnika." });
  if (id) {
    await db.workerProfile.updateMany({ where: { id, salonId: salon.id }, data: { displayName, specialities } });
  } else {
    await db.workerProfile.create({ data: { salonId: salon.id, displayName, specialities } });
  }
  done(slug, "radnici", id ? "Radnik je izmenjen." : `${displayName} je dodat/a.`);
}

/** Gives a worker their own login (email + password set by the owner); it sees only that worker's schedule. */
export async function createWorkerLogin(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const workerId = String(formData.get("workerId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const worker = await db.workerProfile.findFirst({ where: { id: workerId, salonId: salon.id } });
  if (!worker) back(slug, "radnici", { error: "Radnik nije pronađen." });
  if (worker.userId) back(slug, "radnici", { error: "Ovaj radnik već ima nalog." });
  if (!looksLikeEmail(email)) back(slug, "radnici", { error: "Upišite ispravnu email adresu." });
  if (password.length < 8) back(slug, "radnici", { error: "Lozinka mora imati bar 8 znakova." });
  if (password.length > MAX_PASSWORD_LENGTH) back(slug, "radnici", { error: `Lozinka može imati najviše ${MAX_PASSWORD_LENGTH} znakova.` });
  if (!(await consume([{ key: `worker-login:salon:${salon.id}`, limit: 20, windowSec: 3600 }])).ok) {
    back(slug, "radnici", { error: "Previše pokušaja. Pokušajte ponovo kasnije." });
  }
  // Creating a login account (and checking that the email is free) is system work: staff cannot see other users.
  if (await systemDb.user.findUnique({ where: { email }, select: { id: true } })) {
    back(slug, "radnici", { error: "Ta email adresa se već koristi. Izaberite drugu." });
  }
  const user = await systemDb.user.create({
    data: { email, name: worker.displayName, passwordHash: await hashPassword(password), role: "WORKER" },
  });
  await db.workerProfile.update({ where: { id: worker.id }, data: { userId: user.id } });
  done(slug, "radnici", `Nalog za ${worker.displayName} je napravljen (${email}).`);
}

/** Unlinks a worker's login; their past appointments stay. */
export async function removeWorkerLogin(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const worker = await db.workerProfile.findFirst({ where: { id: String(formData.get("workerId") ?? ""), salonId: salon.id } });
  if (!worker?.userId) back(slug, "radnici", { error: "Radnik nema nalog." });
  if (worker.userId === salon.ownerId) back(slug, "radnici", { error: "Nalog vlasnika se ne uklanja." });
  await db.workerProfile.update({ where: { id: worker.id }, data: { userId: null } });
  done(slug, "radnici", "Nalog radnika je uklonjen.");
}

export async function toggleWorker(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!isActive) {
    const others = await db.workerProfile.count({ where: { salonId: salon.id, isActive: true, id: { not: id } } });
    if (others === 0) back(slug, "radnici", { error: "Salon mora imati bar jednog aktivnog radnika." });
    const upcoming = await db.appointment.count({
      where: { salonId: salon.id, workerId: id, status: "BOOKED", startTime: { gte: new Date() } },
    });
    if (upcoming > 0) {
      back(slug, "radnici", {
        error: `Ovaj radnik ima ${upcoming} zakazanih termina. Prvo ih otkažite ili prebacite.`,
      });
    }
  }
  await db.workerProfile.updateMany({ where: { id, salonId: salon.id }, data: { isActive } });
  done(slug, "radnici", isActive ? "Radnik je ponovo aktivan." : "Radnik više ne prima termine.");
}

/** Blocks one hairdresser: whole days (no times) or a time window within one day. */
export async function addWorkerTimeOff(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const workerId = String(formData.get("workerId") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "") || from;
  const fromTime = String(formData.get("fromTime") ?? "").trim();
  const toTime = String(formData.get("toTime") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 120) || null;

  const worker = await db.workerProfile.findFirst({ where: { id: workerId, salonId: salon.id }, select: { id: true } });
  if (!worker) back(slug, "odsustva", { error: "Izaberite radnika." });
  if (!isValidDateIso(from) || !isValidDateIso(to) || to < from) {
    back(slug, "odsustva", { error: "Proverite datume odsustva." });
  }
  if (addDaysIso(from, MAX_DAYS_OFF_RANGE) < to) back(slug, "odsustva", { error: `Najviše ${MAX_DAYS_OFF_RANGE} dana odjednom.` });

  let startTime: Date;
  let endTime: Date;
  if (fromTime || toTime) {
    const start = hhmmToMinutes(fromTime);
    const end = hhmmToMinutes(toTime);
    if (start === null || end === null || start >= end || from !== to) {
      back(slug, "odsustva", { error: "Za deo dana izaberite jedan datum i vreme od–do." });
    }
    startTime = localToUtc(from, start, TIME_ZONE);
    endTime = localToUtc(from, end, TIME_ZONE);
  } else {
    startTime = localToUtc(from, 0, TIME_ZONE);
    endTime = localToUtc(addDaysIso(to, 1), 0, TIME_ZONE);
  }

  await db.workerTimeOff.create({ data: { salonId: salon.id, workerId, startTime, endTime, reason } });
  refresh(slug);
  const booked = await db.appointment.count({
    where: { salonId: salon.id, workerId, status: "BOOKED", startTime: { lt: endTime }, endTime: { gt: startTime } },
  });
  back(slug, "odsustva", {
    ok:
      booked > 0
        ? `Odsustvo je dodato. Pažnja: u tom periodu ovaj radnik već ima ${booked} zakazanih termina.`
        : "Odsustvo je dodato.",
  });
}

export async function removeWorkerTimeOff(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  await db.workerTimeOff.deleteMany({ where: { id: String(formData.get("id") ?? ""), salonId: salon.id } });
  done(slug, "odsustva", "Odsustvo je uklonjeno.");
}

/** Adds a break for one hairdresser: repeating on chosen weekdays, or on a single date. Only the owner decides breaks. */
export async function addWorkerBreak(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const workerId = String(formData.get("workerId") ?? "");
  const startMinute = hhmmToMinutes(String(formData.get("fromTime") ?? ""));
  const endMinute = hhmmToMinutes(String(formData.get("toTime") ?? ""));
  const label = String(formData.get("label") ?? "").trim().slice(0, 60) || null;
  const date = String(formData.get("date") ?? "").trim();

  const worker = await db.workerProfile.findFirst({ where: { id: workerId, salonId: salon.id }, select: { id: true } });
  if (!worker) back(slug, "pauze", { error: "Izaberite radnika." });
  if (startMinute === null || endMinute === null || startMinute >= endMinute) {
    back(slug, "pauze", { error: "Početak pauze mora biti pre kraja." });
  }
  const weekdays = [...new Set(formData.getAll("weekdays").map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (date) {
    if (!isValidDateIso(date)) back(slug, "pauze", { error: "Proverite datum pauze." });
  } else if (weekdays.length === 0) {
    back(slug, "pauze", { error: "Izaberite dane u nedelji ili jedan datum." });
  }

  const rule = {
    workerId,
    startMinute,
    endMinute,
    weekdays: date ? [] : weekdays.sort(),
    date: date ? new Date(`${date}T00:00:00Z`) : null,
  };
  await db.workerBreak.create({ data: { ...rule, salonId: salon.id, label } });
  refresh(slug);

  // Visits already booked inside the new break stay; the owner is told which ones to move.
  const upcoming = await db.appointment.findMany({
    where: { salonId: salon.id, workerId, status: "BOOKED", endTime: { gt: new Date() } },
    select: { startTime: true, endTime: true, guestName: true, client: { select: { name: true } } },
    orderBy: { startTime: "asc" },
  });
  const clashes = appointmentsInBreak(rule, upcoming);
  if (clashes.length === 0) back(slug, "pauze", { ok: "Pauza je dodata." });
  const list = clashes
    .slice(0, 5)
    .map((a) => `${formatLocalDateIso(a.startTime, TIME_ZONE).split("-").reverse().join(".")}. ${formatLocalTime(a.startTime, TIME_ZONE)} ${a.guestName ?? a.client?.name ?? "mušterija"}`)
    .join("; ");
  back(slug, "pauze", {
    ok: `Pauza je dodata. Pažnja: ${clashes.length} već zakazanih termina pada u pauzu (${list}${clashes.length > 5 ? "…" : ""}). Termini nisu otkazani, prebacite ih ručno.`,
  });
}

export async function removeWorkerBreak(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  await db.workerBreak.deleteMany({ where: { id: String(formData.get("id") ?? ""), salonId: salon.id } });
  done(slug, "pauze", "Pauza je uklonjena.");
}

/** Saves how long a set of services takes together, e.g. šišanje + pranje = 30 min. */
export async function saveServiceCombo(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const requested = [...new Set(formData.getAll("serviceIds").map(String))];
  const durationMinutes = Number(formData.get("durationMinutes"));
  if (requested.length < 2) back(slug, "kombinacije", { error: "Izaberite bar dve usluge." });
  if (requested.length > MAX_SERVICES_PER_VISIT) {
    back(slug, "kombinacije", { error: `Najviše ${MAX_SERVICES_PER_VISIT} usluga u kombinaciji.` });
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    back(slug, "kombinacije", { error: "Trajanje mora biti između 5 i 480 minuta." });
  }
  const found = await db.service.count({ where: { id: { in: requested }, salonId: salon.id } });
  if (found !== requested.length) back(slug, "kombinacije", { error: "Usluga nije pronađena." });
  const serviceIds = [...requested].sort();
  // The same set of services replaces its old duration instead of making a duplicate.
  const existing = await db.serviceCombo.findMany({ where: { salonId: salon.id }, select: { id: true, serviceIds: true } });
  const same = existing.find((c) => [...c.serviceIds].sort().join(",") === serviceIds.join(","));
  if (same) {
    await db.serviceCombo.update({ where: { id: same.id }, data: { durationMinutes } });
  } else {
    await db.serviceCombo.create({ data: { salonId: salon.id, serviceIds, durationMinutes } });
  }
  done(slug, "kombinacije", same ? "Trajanje kombinacije je izmenjeno." : "Kombinacija je dodata.");
}

export async function removeServiceCombo(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  await db.serviceCombo.deleteMany({ where: { id: String(formData.get("id") ?? ""), salonId: salon.id } });
  done(slug, "kombinacije", "Kombinacija je obrisana. Te usluge zajedno traju koliko i zbir.");
}
