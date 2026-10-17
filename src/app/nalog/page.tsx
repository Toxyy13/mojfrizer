import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { AppointmentStatus, BookingSource } from "@prisma/client";
import { Avatar } from "@/components/Avatar";
import { AvatarPrompt } from "@/components/AvatarPrompt";
import { shouldShowAvatarPrompt } from "@/lib/avatarPrompt";
import { avatarUrl } from "@/lib/avatar";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CLIENT_STATUS_LABEL } from "@/components/clientStatusLabel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { isSalonRole } from "@/lib/salonVisibility";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { fullAddress } from "@/lib/salonAddress";
import { TIME_ZONE } from "@/lib/time";
import { canReview } from "@/lib/reviews";
import { servicesLabel } from "@/lib/visit";
import { logout } from "../prijava/actions";
import { resendVerification } from "./actions";

export const metadata: Metadata = { title: "Moj nalog · mojfrizer" };
export const dynamic = "force-dynamic";

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
  source: BookingSource;
  price: number;
  manageToken: string;
  review: { id: string } | null;
  salon: { name: string; slug: string };
  service: { id: string; name: string };
  services: { service: { id: string; name: string } }[];
  worker: { id: string; displayName: string };
}

function bookedServiceIds(b: BookingRow): string[] {
  return b.services.length > 0 ? b.services.map((i) => i.service.id) : [b.service.id];
}

const dayFormat = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: TIME_ZONE, day: "numeric" });
const monthFormat = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: TIME_ZONE, month: "short" });
const whenFormat = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: TIME_ZONE, weekday: "long", hour: "2-digit", minute: "2-digit" });

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  BOOKED: "bg-burgundy-soft text-burgundy",
  COMPLETED: "bg-forest-soft text-forest",
  CANCELLED: "bg-sand text-muted",
  NO_SHOW: "bg-sand text-muted",
};

function BookingList({ title, bookings, empty, upcoming }: { title: string; bookings: BookingRow[]; empty: ReactNode; upcoming?: boolean }) {
  return (
    <section>
      <h2 className="font-serif text-2xl sm:text-3xl">{title}</h2>
      {bookings.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-line p-6 text-muted">{empty}</div>}
      <ul className={`grid grid-cols-1 ${bookings.length === 0 ? "" : upcoming ? "mt-4 gap-3" : "mt-4 divide-y divide-line border-y border-line"}`}>
        {bookings.map((b) => (
          <li key={b.id} className={upcoming ? "card flex items-center gap-4 p-4 sm:p-5" : "flex items-center gap-4 py-4"}>
            <div
              className={`grid w-14 shrink-0 place-items-center rounded-xl py-2 text-center ${
                upcoming ? "bg-burgundy text-white" : "bg-sand text-charcoal"
              }`}
              aria-hidden
            >
              <span className="font-serif text-2xl leading-none">{dayFormat.format(b.startTime).replace(".", "")}</span>
              <span className="mt-0.5 text-[11px] uppercase tracking-wider opacity-80">{monthFormat.format(b.startTime)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium first-letter:uppercase">
                <span className="sr-only">{dateFormat.format(b.startTime)} · </span>
                <span aria-hidden>{whenFormat.format(b.startTime)}</span>
              </p>
              <p className="mt-0.5 truncate text-sm text-muted">
                {servicesLabel(b)} · {b.worker.displayName} ·{" "}
                <Link href={`/s/${b.salon.slug}`} className="link">
                  {b.salon.name}
                </Link>
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className={`badge ${STATUS_BADGE[b.status]}`}>{CLIENT_STATUS_LABEL[b.status]}</span>
              <p className="mt-1 text-sm tabular-nums text-muted">{formatPrice(b.price)}</p>
              {b.status === "BOOKED" && (
                <Link href={`/termin/${b.manageToken}`} className="link mt-1 inline-block text-xs text-muted">
                  Otkaži / pomeri
                </Link>
              )}
              {!b.review && canReview(b) && (
                <Link href={`/termin/${b.manageToken}`} className="link mt-1 mr-3 inline-block text-xs text-burgundy">
                  Oceni
                </Link>
              )}
              {b.status !== "BOOKED" && (
                <Link
                  href={`/s/${b.salon.slug}?usluga=${bookedServiceIds(b).join(",")}&frizer=${b.worker.id}#zakazivanje`}
                  className="link mt-1 inline-block text-xs text-muted"
                >
                  Zakaži ponovo
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function AccountPage() {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/nalog");
  if (isSalonRole(session.role)) redirect("/admin");

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      phone: true,
      emailVerifiedAt: true,
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
          source: true,
          price: true,
          manageToken: true,
          review: { select: { id: true } },
          salon: { select: { name: true, slug: true } },
          service: { select: { id: true, name: true } },
          services: { select: { service: { select: { id: true, name: true } } }, orderBy: { sortOrder: "asc" } },
          worker: { select: { id: true, displayName: true } },
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

  const firstName = user.name.split(" ")[0];

  return (
    <>
      <SiteHeader />
      <main id="sadrzaj" tabIndex={-1} className="page py-10 sm:py-16">
        <header className="animate-rise flex flex-wrap items-center gap-5">
          <Avatar name={user.name} src={avatarUrl(user.id, user.avatar)} size={72} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Moj nalog</p>
            <h1 className="mt-1 font-serif text-4xl leading-none sm:text-6xl">Zdravo, {firstName}</h1>
            <p className="mt-2 truncate text-sm text-muted">
              {[user.phone ? formatPhone(user.phone) : null, user.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Link href="/nalog/profil" className="btn-secondary btn-sm">
            Uredi profil
          </Link>
        </header>

        {user.email && !user.emailVerifiedAt && (
          <form
            action={resendVerification}
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-burgundy-soft px-5 py-4 text-sm text-burgundy"
            role="note"
          >
            <span>Potvrdite email adresu ({user.email}) linkom koji smo vam poslali, da biste dobijali podsetnike za termine.</span>
            <button className="btn-secondary btn-sm">Pošalji ponovo</button>
          </form>
        )}

        {(await shouldShowAvatarPrompt(session.role, !!user.avatar)) && <AvatarPrompt className="mt-6" />}

        {!user.phone && (
          <p className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-burgundy-soft px-5 py-4 text-sm text-burgundy" role="note">
            Dodajte broj telefona i sliku, da vas salon može pozvati ako je potrebno.
            <Link href="/nalog/profil" className="btn-primary btn-sm">
              Dopunite profil
            </Link>
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid min-w-0 grid-cols-1 content-start gap-12">
            <BookingList
              title="Predstojeći termini"
              bookings={upcoming}
              upcoming
              empty={
                <>
                  Nemate zakazanih termina.{" "}
                  <Link href={user.favoriteSalon ? `/s/${user.favoriteSalon.slug}#zakazivanje` : "/"} className="link text-charcoal">
                    Zakažite sada
                  </Link>
                </>
              }
            />
            <BookingList title="Ranije" bookings={past} empty="Još nema ranijih termina." />
          </div>

          <aside className="grid min-w-0 content-start gap-4">
            <section className="card p-5">
              <h2 className="eyebrow">Omiljeni salon</h2>
              {user.favoriteSalon ? (
                <>
                  <Link href={`/s/${user.favoriteSalon.slug}`} className="group mt-3 block">
                    <span className="font-serif text-3xl transition-colors duration-300 group-hover:text-burgundy">
                      {user.favoriteSalon.name}
                    </span>
                    <span className="mt-1 block text-sm text-muted">{fullAddress(user.favoriteSalon)}</span>
                  </Link>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/s/${user.favoriteSalon.slug}#zakazivanje`} className="btn-primary btn-sm">
                      Zakaži
                    </Link>
                    <FavoriteButton salonId={user.favoriteSalon.id} isFavorite returnTo="/nalog" />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Još niste izabrali.{" "}
                  <Link href="/" className="link text-charcoal">
                    Pronađite salon
                  </Link>{" "}
                  i posle prijave idete pravo na njega.
                </p>
              )}
            </section>

            <section className="card p-5">
              <h2 className="eyebrow">Poruke</h2>
              {chats.length === 0 && <p className="mt-3 text-sm text-muted">Pišite salonu sa njegove stranice.</p>}
              <ul className="mt-2 divide-y divide-line">
                {chats.map((c) => {
                  const count = unreadBy.get(c.salon.id) ?? 0;
                  return (
                    <li key={c.salon.id}>
                      <Link href={`/poruke/${c.salon.slug}`} className="group flex items-center justify-between gap-3 py-3">
                        <span className="min-w-0">
                          <span className={`block group-hover:text-burgundy ${count > 0 ? "font-semibold" : ""}`}>{c.salon.name}</span>
                          <span className="mt-0.5 block truncate text-sm text-muted">{c.text}</span>
                        </span>
                        {count > 0 && <span className="badge shrink-0 bg-burgundy text-white">{count} nova</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <Link href="/nalog/lozinka" className="btn-ghost w-full">
              Promena lozinke
            </Link>

            <Link href="/brisanje-podataka" className="btn-ghost w-full">
              Mejlovi, podaci i brisanje naloga
            </Link>

            <form action={logout}>
              <button className="btn-ghost w-full">Odjavi se</button>
            </form>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
