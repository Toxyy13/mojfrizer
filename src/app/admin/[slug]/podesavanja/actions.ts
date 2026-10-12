"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSalonOwner } from "@/lib/access";
import { rsdToPara } from "@/lib/money";
import { formatPhone, normalizePhone } from "@/lib/phone";
import {
  MAX_DAYS_OFF_RANGE,
  dayOffSchema,
  hhmmToMinutes,
  parseWeeklyHours,
  readServiceForm,
  salonInfoSchema,
} from "@/lib/salonSettings";
import { TIME_ZONE, WEEKDAYS_SR, addDaysIso, isValidDateIso, localToUtc } from "@/lib/time";

// Each action redirects back with ?ok= or ?greska= so the page can show the outcome without client JS.
function back(slug: string, section: string, outcome: { ok: string } | { error: string }): never {
  const params = new URLSearchParams("ok" in outcome ? { ok: outcome.ok } : { greska: outcome.error });
  redirect(`/admin/${slug}/podesavanja?${params.toString()}#${section}`);
}

function refresh(slug: string): void {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/s/${slug}`);
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
  });
  if (!parsed.success) back(slug, "salon", { error: parsed.error.issues[0]?.message ?? "Neispravni podaci" });
  const { phone: rawPhone, description, ...rest } = parsed.data;
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) back(slug, "salon", { error: "Broj telefona nije ispravan, npr. 018 123 456." });
  try {
    await db.salon.update({
      where: { id: salon.id },
      data: { ...rest, description: description || null, phone: phone ? formatPhone(phone) : null },
    });
  } catch (error) {
    console.error(error);
    back(slug, "salon", { error: "Čuvanje nije uspelo." });
  }
  refresh(slug);
  back(slug, "salon", { ok: "Podaci o salonu su sačuvani." });
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
  refresh(slug);
  back(slug, "usluge", { ok: id ? `Usluga „${f.name}" je izmenjena.` : `Usluga „${f.name}" je dodata.` });
}

/** Hides or shows a service. Services are never deleted because past appointments point to them. */
export async function toggleService(slug: string, formData: FormData): Promise<void> {
  const { salon } = await requireSalonOwner(slug);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  await db.service.updateMany({ where: { id, salonId: salon.id }, data: { isActive } });
  refresh(slug);
  back(slug, "usluge", { ok: isActive ? "Usluga je ponovo u cenovniku." : "Usluga je sklonjena iz cenovnika." });
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
  refresh(slug);
  back(slug, "radno-vreme", { ok: "Radno vreme je sačuvano. Već zakazani termini ostaju." });
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
  refresh(slug);
  back(slug, "neradni-dani", { ok: "Neradni dan je uklonjen." });
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
  refresh(slug);
  back(slug, "radnici", { ok: id ? "Radnik je izmenjen." : `${displayName} je dodat/a.` });
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
  refresh(slug);
  back(slug, "radnici", { ok: isActive ? "Radnik je ponovo aktivan." : "Radnik više ne prima termine." });
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
  refresh(slug);
  back(slug, "odsustva", { ok: "Odsustvo je uklonjeno." });
}
