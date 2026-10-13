// Seeds the first salon, "Kod Olgice".
// Values marked PLACEHOLDER must be replaced with the salon's real data.
import { PrismaClient, Role, BookingSource } from "@prisma/client";
import { hash } from "bcryptjs";
import { ensureDeveloper } from "./seedDeveloper";

const prisma = new PrismaClient();

const TIME_ZONE = "Europe/Belgrade";

interface SeedService {
  name: string;
  category: string;
  priceRsd: number;
  comboPriceRsd?: number;
  durationMinutes: number;
}

// Durations are estimates, confirm with the salon.
const SERVICES: SeedService[] = [
  { name: "Muško šišanje", category: "Šišanje", priceRsd: 600, durationMinutes: 30 },
  { name: "Pranje kose", category: "Pranje", priceRsd: 150, durationMinutes: 15 },
  { name: "Brijanje", category: "Brijanje", priceRsd: 150, durationMinutes: 15 },
  // 200 RSD on its own, free together with another service.
  { name: "Fazoniranje brade", category: "Brijanje", priceRsd: 200, comboPriceRsd: 0, durationMinutes: 15 },
];

// Durations the owner set for services booked together; other sets take the sum.
const COMBOS: Array<{ names: string[]; durationMinutes: number }> = [
  { names: ["Muško šišanje", "Pranje kose"], durationMinutes: 30 },
  { names: ["Muško šišanje", "Pranje kose", "Fazoniranje brade"], durationMinutes: 45 },
  { names: ["Muško šišanje", "Pranje kose", "Brijanje"], durationMinutes: 45 },
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

// On a hosted deployment (Vercel) the seed runs against the real database: the owner's password
// must come from SEED_OWNER_PASSWORD (the repo is public) and demo data is left out unless SEED_DEMO=1.
const isHosted = Boolean(process.env.VERCEL);
const withDemoData = !isHosted || process.env.SEED_DEMO === "1";

function ownerPassword(): string {
  const fromEnv = process.env.SEED_OWNER_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < 8) throw new Error("SEED_OWNER_PASSWORD must be at least 8 characters");
    return fromEnv;
  }
  if (isHosted) throw new Error("Set SEED_OWNER_PASSWORD in the hosting environment variables");
  return "promeni-me";
}

async function main(): Promise<void> {
  console.log(`Developer account: ${await ensureDeveloper(prisma, process.env)}`);
  const ownerEmail = process.env.SEED_OWNER_EMAIL || "olgica@mojfrizer.com";
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  // Only hash (and require) a password when the owner account is actually created.
  const owner =
    existingOwner ??
    (await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: await hash(ownerPassword(), 10),
        name: "Olgica",
        role: Role.ADMIN,
        emailVerifiedAt: new Date(),
      },
    }));

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
          comboPrice: service.comboPriceRsd === undefined ? null : rsdToPara(service.comboPriceRsd),
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

  await prisma.serviceCombo.createMany({
    data: COMBOS.map((combo) => ({
      salonId: salon.id,
      serviceIds: salon.services
        .filter((service) => combo.names.includes(service.name))
        .map((service) => service.id)
        .sort(),
      durationMinutes: combo.durationMinutes,
    })),
  });

  if (!withDemoData) {
    console.log(`Seeded ${salon.name}: ${salon.services.length} services, no demo data.`);
    return;
  }

  // Demo client who marked Kod Olgice as favorite.
  const passwordHash = await hash("promeni-me", 10);
  const client = await prisma.user.upsert({
    where: { email: "milica@example.com" },
    update: {},
    create: {
      email: "milica@example.com",
      emailVerifiedAt: new Date(),
      phone: "+381641234567",
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
  const demoAppointments = [
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
  ];
  for (const data of demoAppointments) {
    await prisma.appointment.create({
      data: { ...data, services: { create: [{ serviceId: data.serviceId, price: data.price, sortOrder: 0 }] } },
    });
  }

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
