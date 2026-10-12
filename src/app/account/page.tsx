import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRsd } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { fullAddress } from "@/lib/salonAddress";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Moj nalog · mojfrizer" };
export const dynamic = "force-dynamic";

// Salons are in Serbia; show booking times in local time.
const TIME_ZONE = "Europe/Belgrade";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Zakazano",
  COMPLETED: "Završeno",
  CANCELLED: "Otkazano",
  NO_SHOW: "Niste došli",
};

const dateFormat = new Intl.DateTimeFormat("sr-Latn-RS", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

interface BookingRow {
  id: string;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  price: number;
  salon: { name: string; slug: string };
  service: { name: string };
  worker: { displayName: string };
}

function BookingList({ title, bookings, empty }: { title: string; bookings: BookingRow[]; empty: string }) {
  return (
    <section className="mt-20">
      <h2 className="text-xs uppercase tracking-[0.3em] text-neutral-500">{title}</h2>
      <ul className="mt-6 border-t border-neutral-200">
        {bookings.length === 0 && <li className="py-6 text-neutral-500">{empty}</li>}
        {bookings.map((b) => (
          <li key={b.id} className="grid gap-1 border-b border-neutral-200 py-6 md:grid-cols-[1fr_auto] md:items-baseline">
            <div>
              <p className="font-serif text-2xl first-letter:uppercase">{dateFormat.format(b.startTime)}</p>
              <p className="mt-1 text-sm text-neutral-600">
                {b.service.name} · {b.worker.displayName} ·{" "}
                <Link href={`/s/${b.salon.slug}`} className="underline underline-offset-4 hover:text-burgundy">
                  {b.salon.name}
                </Link>
              </p>
            </div>
            <p className="text-sm text-neutral-500 md:text-right">
              {b.price === 0 ? "Gratis" : formatRsd(b.price)} · {STATUS_LABEL[b.status]}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AccountPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login?next=/account");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      phone: true,
      email: true,
      favoriteSalon: { select: { id: true, name: true, slug: true, city: true, address: true } },
      clientAppointments: {
        orderBy: { startTime: "desc" },
        take: 100,
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          price: true,
          salon: { select: { name: true, slug: true } },
          service: { select: { name: true } },
          worker: { select: { displayName: true } },
        },
      },
    },
  });
  if (!user) redirect("/login?next=/account");

  const now = new Date();
  const isUpcoming = (b: BookingRow): boolean => b.status === "BOOKED" && b.endTime >= now;
  const upcoming = user.clientAppointments.filter(isUpcoming).reverse();
  const past = user.clientAppointments.filter((b) => !isUpcoming(b));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Moj nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none md:text-8xl">{user.name}</h1>
        <p className="mt-4 text-sm text-neutral-500">{user.phone ? formatPhone(user.phone) : user.email}</p>

        <section className="mt-20 grid gap-6 border border-neutral-200 p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-xs uppercase tracking-[0.3em] text-neutral-500">Omiljeni salon</h2>
            {user.favoriteSalon ? (
              <Link href={`/s/${user.favoriteSalon.slug}`} className="group mt-3 block">
                <span className="font-serif text-4xl transition-colors duration-300 group-hover:text-burgundy">
                  {user.favoriteSalon.name}
                </span>
                <span className="mt-1 block text-sm text-neutral-500">
                  {fullAddress(user.favoriteSalon)}
                </span>
              </Link>
            ) : (
              <p className="mt-3 text-neutral-600">
                Još niste izabrali.{" "}
                <Link href="/search" className="text-burgundy underline underline-offset-4">
                  Pronađite salon
                </Link>{" "}
                i posle prijave idete pravo na njega.
              </p>
            )}
          </div>
          {user.favoriteSalon && (
            <FavoriteButton salonId={user.favoriteSalon.id} isFavorite returnTo="/account" />
          )}
        </section>

        <BookingList title="Predstojeći termini" bookings={upcoming} empty="Nemate zakazanih termina." />
        <BookingList title="Ranije" bookings={past} empty="Još nema ranijih termina." />

        <form action={logout} className="mt-20 border-t border-neutral-200 pt-6">
          <button className="text-sm text-neutral-500 underline underline-offset-4 hover:text-burgundy">Odjava</button>
        </form>
      </main>
    </>
  );
}
