// Seeds the first salon, "Kod Olgice".
// Values marked PLACEHOLDER must be replaced with the salon's real data.
import { PrismaClient, Role, BookingSource } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const TIME_ZONE = "Europe/Belgrade";

interface SeedService {
  name: string;
  category: string;
  priceRsd: number;
  durationMinutes: number;
}

// PLACEHOLDER price list, replace with the real one.
const SERVICES: SeedService[] = [
  { name: "Žensko šišanje", category: "Šišanje", priceRsd: 1500, durationMinutes: 45 },
  { name: "Muško šišanje", category: "Šišanje", priceRsd: 900, durationMinutes: 30 },
  { name: "Dečije šišanje", category: "Šišanje", priceRsd: 700, durationMinutes: 30 },
  { name: "Pranje i feniranje", category: "Feniranje", priceRsd: 1000, durationMinutes: 30 },
  { name: "Farbanje (kratka kosa)", category: "Farbanje", priceRsd: 3000, durationMinutes: 90 },
  { name: "Farbanje (duga kosa)", category: "Farbanje", priceRsd: 4500, durationMinutes: 120 },
  { name: "Pramenovi", category: "Farbanje", priceRsd: 5000, durationMinutes: 120 },
  { name: "Svečana frizura", category: "Frizure", priceRsd: 2500, durationMinutes: 60 },
];

const rsdToPara = (rsd: number): number => rsd * 100;
const hm = (hours: number, minutes = 0): number => hours * 60 + minutes;
const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60_000);

// Returns the UTC instant for a wall-clock time in Belgrade, `daysAhead` days from today.
function belgradeTime(daysAhead: number, hours: number, minutes = 0): Date {
  const day = new Date(Date.now() + daysAhead * 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(day);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(day)
    .find((part) => part.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return new Date(`${ymd}T${time}${offset}`);
}

async function main(): Promise<void> {
  const passwordHash = await hash("promeni-me", 10);

  // PLACEHOLDER owner account.
  const owner = await prisma.user.upsert({
    where: { email: "olgica@mojfrizer.com" },
    update: {},
    create: { email: "olgica@mojfrizer.com", passwordHash, name: "Olgica", role: Role.ADMIN },
  });

  const existing = await prisma.salon.findUnique({ where: { slug: "kod-olgice" } });
  if (existing) {
    console.log("Kod Olgice already seeded, skipping.");
    return;
  }

  const salon = await prisma.salon.create({
    data: {
      name: "Kod Olgice",
      slug: "kod-olgice",
      description: "Frizerski salon Kod Olgice.", // PLACEHOLDER
      city: "Beograd", // PLACEHOLDER
      address: "Ulica i broj", // PLACEHOLDER
      phone: "+381 60 000 0000", // PLACEHOLDER
      ownerId: owner.id,
      // PLACEHOLDER hours: Mon-Fri 09-20, Sat 09-15, Sunday closed.
      workingHours: {
        create: [
          ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, opensAt: hm(9), closesAt: hm(20) })),
          { dayOfWeek: 6, opensAt: hm(9), closesAt: hm(15) },
        ],
      },
      services: {
        create: SERVICES.map((service, index) => ({
          name: service.name,
          category: service.category,
          price: rsdToPara(service.priceRsd),
          durationMinutes: service.durationMinutes,
          sortOrder: index,
        })),
      },
      workers: {
        create: [{ displayName: "Olgica", userId: owner.id, specialities: ["Šišanje", "Farbanje"] }],
      },
    },
    include: { services: { orderBy: { sortOrder: "asc" } }, workers: true },
  });

  // Demo client who marked Kod Olgice as favorite.
  const client = await prisma.user.upsert({
    where: { email: "milica@example.com" },
    update: {},
    create: {
      email: "milica@example.com",
      passwordHash,
      name: "Milica Demo",
      role: Role.CLIENT,
      favoriteSalonId: salon.id,
    },
  });

  const worker = salon.workers[0];
  const haircut = salon.services[0];
  const color = salon.services[4];
  const haircutStart = belgradeTime(1, 10);
  const colorStart = belgradeTime(1, 12);

  // One online booking by the client, one booked by the salon for a phone customer.
  await prisma.appointment.createMany({
    data: [
      {
        salonId: salon.id,
        workerId: worker.id,
        serviceId: haircut.id,
        clientId: client.id,
        source: BookingSource.ONLINE,
        createdById: client.id,
        startTime: haircutStart,
        endTime: addMinutes(haircutStart, haircut.durationMinutes),
        price: haircut.price,
      },
      {
        salonId: salon.id,
        workerId: worker.id,
        serviceId: color.id,
        guestName: "Gospođa Ljubica",
        guestPhone: "+381 64 111 2222",
        source: BookingSource.SALON,
        createdById: owner.id,
        startTime: colorStart,
        endTime: addMinutes(colorStart, color.durationMinutes),
        price: color.price,
        note: "Zvala telefonom.",
      },
    ],
  });

  console.log(`Seeded ${salon.name}: ${salon.services.length} services, 2 appointments.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
