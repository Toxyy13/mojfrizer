import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUploader } from "@/components/AvatarUploader";
import { AuthShell } from "@/components/AuthShell";
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
    <AuthShell
      eyebrow="Moj nalog"
      title="Profil"
      intro="Slika i telefon pomažu salonu da vas prepozna i pozove ako je potrebno."
      footer={
        <Link href="/nalog" className="link">
          ← Nazad na nalog
        </Link>
      }
    >
      <AvatarUploader name={user.name} src={avatarUrl(user.id, user.avatar)} />
      <ProfileForm name={user.name} phone={user.phone ? formatPhone(user.phone) : ""} />
    </AuthShell>
  );
}
