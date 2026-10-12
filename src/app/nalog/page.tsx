import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import { avatarUrl } from "@/lib/avatar";
import { FavoriteButton } from "@/components/FavoriteButton";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { fullAddress } from "@/lib/salonAddress";
import { logout } from "../prijava/actions";

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
  manageToken: string;
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
              {formatPrice(b.price)} · {STATUS_LABEL[b.status]}
              {b.status === "BOOKED" && (
                <Link href={`/termin/${b.manageToken}`} className="ml-3 underline underline-offset-4 hover:text-burgundy">
                  Otkaži / pomeri
                </Link>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AccountPage() {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/nalog");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      phone: true,
      avatar: { select: { updatedAt: true } },
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
          manageToken: true,
          salon: { select: { name: true, slug: true } },
          service: { select: { name: true } },
          worker: { select: { displayName: true } },
        },
      },
    },
  });
  if (!user) redirect("/prijava?next=/nalog");

  const [chats, unread] = await Promise.all([
    db.chatMessage.findMany({
      where: { clientId: session.id },
      orderBy: { createdAt: "desc" },
      distinct: ["salonId"],
      select: { text: true, salon: { select: { id: true, name: true, slug: true } } },
    }),
    db.chatMessage.groupBy({
      by: ["salonId"],
      where: { clientId: session.id, fromSalon: true, readAt: null },
      _count: { _all: true },
    }),
  ]);
  const unreadBy = new Map(unread.map((u) => [u.salonId, u._count._all]));

  const now = new Date();
  const isUpcoming = (b: BookingRow): boolean => b.status === "BOOKED" && b.endTime >= now;
  const upcoming = user.clientAppointments.filter(isUpcoming).reverse();
  const past = user.clientAppointments.filter((b) => !isUpcoming(b));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Moj nalog</p>
        <div className="mt-6 flex items-center gap-6">
          <Avatar name={user.name} src={avatarUrl(user.id, user.avatar)} size={72} />
          <h1 className="font-serif text-5xl leading-none md:text-7xl">{user.name}</h1>
        </div>
        <p className="mt-4 text-sm text-neutral-500">
          {[user.phone ? formatPhone(user.phone) : null, user.email].filter(Boolean).join(" · ")} ·{" "}
          <Link href="/nalog/profil" className="underline underline-offset-4 hover:text-burgundy">
            Uredi profil
          </Link>
        </p>
        {!user.phone && (
          <p className="mt-8 border-l-2 border-burgundy pl-4 text-burgundy" role="note">
            Dodajte broj telefona i sliku, da vas salon može pozvati ako je potrebno.{" "}
            <Link href="/nalog/profil" className="underline underline-offset-4">
              Dopunite profil
            </Link>
          </p>
        )}

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
                <Link href="/" className="text-burgundy underline underline-offset-4">
                  Pronađite salon
                </Link>{" "}
                i posle prijave idete pravo na njega.
              </p>
            )}
          </div>
          {user.favoriteSalon && (
            <FavoriteButton salonId={user.favoriteSalon.id} isFavorite returnTo="/nalog" />
          )}
        </section>

        {chats.length > 0 && (
          <section className="mt-20">
            <h2 className="text-xs uppercase tracking-[0.3em] text-neutral-500">Poruke</h2>
            <ul className="mt-6 border-t border-neutral-200">
              {chats.map((c) => {
                const count = unreadBy.get(c.salon.id) ?? 0;
                return (
                  <li key={c.salon.id}>
                    <Link
                      href={`/poruke/${c.salon.slug}`}
                      className="flex items-baseline justify-between gap-4 border-b border-neutral-200 py-5 hover:text-burgundy"
                    >
                      <span className="min-w-0">
                        <span className={`block text-xl ${count > 0 ? "font-semibold" : ""}`}>{c.salon.name}</span>
                        <span className="mt-1 block truncate text-sm text-neutral-500">{c.text}</span>
                      </span>
                      {count > 0 && <span className="shrink-0 bg-burgundy px-2 py-0.5 text-xs text-white">{count} nova</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <BookingList title="Predstojeći termini" bookings={upcoming} empty="Nemate zakazanih termina." />
        <BookingList title="Ranije" bookings={past} empty="Još nema ranijih termina." />

        <form action={logout} className="mt-20 border-t border-neutral-200 pt-6">
          <button className="text-sm text-neutral-500 underline underline-offset-4 hover:text-burgundy">Odjava</button>
        </form>
      </main>
    </>
  );
}
