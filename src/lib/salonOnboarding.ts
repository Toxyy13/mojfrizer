import { Prisma, Role } from "@prisma/client";
import { db } from "./db";

// Salon creation. Only the platform developer creates salons (src/app/razvoj); the owner then fills in prices and hours in Podešavanja.

// Path segments and subdomains a salon slug must not take.
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "www", "mail", "s", "prijava", "registracija", "registracija-salona", "nalog", "poruke",
  "razvoj", "dodaj-salon", "termin", "zaboravljena-lozinka", "nova-lozinka", "potvrda-emaila", "mojfrizer", "podrska", "blog", "pomoc",
]);

const TRANSLIT: Record<string, string> = { š: "s", đ: "dj", č: "c", ć: "c", ž: "z" };

/** "Salon Lepota Đurđa" -> "salon-lepota-djurdja" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[šđčćž]/g, (c) => TRANSLIT[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** First free slug: "kod-olgice", then "kod-olgice-nis", then "kod-olgice-2", ... */
export async function uniqueSlug(name: string, city: string): Promise<string> {
  const base = slugify(name) || "salon";
  const candidates = [base, `${base}-${slugify(city)}`, ...Array.from({ length: 20 }, (_, i) => `${base}-${i + 2}`)];
  for (const slug of candidates) {
    if (slug.length < 3 || RESERVED_SLUGS.has(slug)) continue;
    const taken = await db.salon.count({ where: { slug } });
    if (taken === 0) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Starting hours the owner adjusts later: Mon-Fri 9-17, Sat 9-14.
const DEFAULT_HOURS = [1, 2, 3, 4, 5]
  .map((dayOfWeek) => ({ dayOfWeek, opensAt: 9 * 60, closesAt: 17 * 60 }))
  .concat([{ dayOfWeek: 6, opensAt: 9 * 60, closesAt: 14 * 60 }]);

export interface NewSalonInput {
  ownerId: string;
  ownerName: string;
  name: string;
  city: string;
  address: string;
  phone: string | null;
}

/** Creates the salon with default hours and the owner as its first hairdresser. Returns the slug. */
export async function createSalon(input: NewSalonInput): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = await uniqueSlug(input.name, input.city);
    try {
      await db.$transaction(async (tx) => {
        await tx.salon.create({
          data: {
            name: input.name,
            slug,
            city: input.city,
            address: input.address,
            phone: input.phone,
            ownerId: input.ownerId,
            workingHours: { create: DEFAULT_HOURS },
            workers: { create: { displayName: input.ownerName, userId: input.ownerId } },
          },
        });
        // A customer account that opens a salon becomes a salon admin.
        await tx.user.updateMany({ where: { id: input.ownerId, role: Role.CLIENT }, data: { role: Role.ADMIN } });
      });
      return slug;
    } catch (error) {
      // Two sign-ups raced for the same slug; pick the next one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("Could not find a free salon slug");
}
