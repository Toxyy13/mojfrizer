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

// Durations are estimates, confirm with the salon.
const SERVICES: SeedService[] = [
  { name: "Muško šišanje", category: "Šišanje", priceRsd: 600, durationMinutes: 30 },
  { name: "Pranje kose", category: "Pranje", priceRsd: 150, durationMinutes: 15 },
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
      city: "Niš",
      address: "Nikole Pašića 27, 18000 Niš",
      phone: "+381 60 000 0000", // PLACEHOLDER
      ownerId: owner.id,
      // Mon-Sat 09-19, Sunday closed.
      workingHours: {
        create: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, opensAt: hm(9), closesAt: hm(19) })),
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
        create: [{ displayName: "Olgica", userId: owner.id, specialities: ["Šišanje"] }],
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
  const wash = salon.services[1];
  const haircutStart = belgradeTime(1, 10);
  const washStart = belgradeTime(1, 12);

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
        serviceId: wash.id,
        guestName: "Gospodin Dragan",
        guestPhone: "+381 64 111 2222",
        source: BookingSource.SALON,
        createdById: owner.id,
        startTime: washStart,
        endTime: addMinutes(washStart, wash.durationMinutes),
        price: wash.price,
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
