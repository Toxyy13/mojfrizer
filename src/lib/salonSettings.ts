import { z } from "zod";

// Parsing and validation for the salon settings forms in the admin panel.

/** "09:30" -> 570; null when empty or malformed. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || h * 60 + m > 24 * 60) return null;
  return h * 60 + m;
}

export interface HoursRange {
  dayOfWeek: number;
  opensAt: number;
  closesAt: number;
}

export type HoursResult = { ok: true; ranges: HoursRange[] } | { ok: false; error: string };

/**
 * Reads the weekly hours form: per day an "open" checkbox, opening and closing time,
 * and an optional break that splits the day into two ranges.
 */
export function parseWeeklyHours(formData: FormData, dayNames: readonly string[]): HoursResult {
  const ranges: HoursRange[] = [];
  for (let day = 1; day <= 7; day++) {
    if (formData.get(`open-${day}`) !== "on") continue;
    const name = dayNames[day];
    const opens = hhmmToMinutes(String(formData.get(`from-${day}`) ?? ""));
    const closes = hhmmToMinutes(String(formData.get(`to-${day}`) ?? ""));
    if (opens === null || closes === null || opens >= closes) {
      return { ok: false, error: `${name}: početak mora biti pre kraja radnog vremena.` };
    }
    const breakFromRaw = String(formData.get(`breakFrom-${day}`) ?? "").trim();
    const breakToRaw = String(formData.get(`breakTo-${day}`) ?? "").trim();
    if (!breakFromRaw && !breakToRaw) {
      ranges.push({ dayOfWeek: day, opensAt: opens, closesAt: closes });
      continue;
    }
    const breakFrom = hhmmToMinutes(breakFromRaw);
    const breakTo = hhmmToMinutes(breakToRaw);
    if (breakFrom === null || breakTo === null || breakFrom >= breakTo || breakFrom <= opens || breakTo >= closes) {
      return { ok: false, error: `${name}: pauza mora biti unutar radnog vremena.` };
    }
    ranges.push({ dayOfWeek: day, opensAt: opens, closesAt: breakFrom });
    ranges.push({ dayOfWeek: day, opensAt: breakTo, closesAt: closes });
  }
  return { ok: true, ranges };
}

const rsd = z.coerce.number().int("Cena mora biti ceo broj dinara").min(0, "Cena ne može biti negativna").max(1_000_000);

export const serviceFormSchema = z.object({
  name: z.string().trim().min(2, "Upišite naziv usluge").max(80),
  category: z.string().trim().max(40),
  description: z.string().trim().max(300),
  priceRsd: rsd,
  // Empty = no special price together with another service.
  comboPriceRsd: z.union([z.literal(""), rsd]),
  durationMinutes: z.coerce.number().int().min(5, "Trajanje bar 5 minuta").max(480, "Trajanje najviše 8 sati"),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export type ServiceForm = z.infer<typeof serviceFormSchema>;

export function readServiceForm(formData: FormData): ReturnType<typeof serviceFormSchema.safeParse> {
  return serviceFormSchema.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    description: formData.get("description") ?? "",
    priceRsd: formData.get("priceRsd") ?? "",
    comboPriceRsd: formData.get("comboPriceRsd") ?? "",
    durationMinutes: formData.get("durationMinutes") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export const salonInfoSchema = z.object({
  name: z.string().trim().min(2, "Upišite naziv salona").max(80),
  description: z.string().trim().max(1000),
  address: z.string().trim().min(3, "Upišite adresu").max(120),
  city: z.string().trim().min(2, "Upišite grad").max(60),
  phone: z.string().trim().max(30),
  slotStepMinutes: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Neispravan korak"),
  cancelCutoffHours: z.coerce.number().int().min(0).max(72),
});

export const dayOffSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Izaberite datum"),
  to: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  reason: z.string().trim().max(120),
});

// A vacation is entered as a range; cap it so a typo can't create thousands of rows.
export const MAX_DAYS_OFF_RANGE = 60;
