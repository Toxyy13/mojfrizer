import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUploader } from "@/components/AvatarUploader";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/auth";
import { avatarUrl } from "@/lib/avatar";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Profil · mojfrizer" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSessionUser();
  if (!session) redirect("/prijava?next=/nalog/profil");
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, phone: true, avatar: { select: { updatedAt: true } } },
  });
  if (!user) redirect("/prijava?next=/nalog/profil");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Moj nalog</p>
        <h1 className="mt-6 font-serif text-6xl leading-none">Profil</h1>
        <p className="mt-6 text-neutral-600">
          Slika i telefon pomažu salonu da vas prepozna i pozove ako je potrebno.{" "}
          <Link href="/nalog" className="underline underline-offset-4 hover:text-burgundy">
            Nazad na nalog
          </Link>
        </p>
        <div className="mt-12">
          <AvatarUploader name={user.name} src={avatarUrl(user.id, user.avatar)} />
        </div>
        <ProfileForm name={user.name} phone={user.phone ? formatPhone(user.phone) : ""} />
      </main>
    </>
  );
}
