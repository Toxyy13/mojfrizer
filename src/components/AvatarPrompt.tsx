import Link from "next/link";
import { snoozeAvatarPrompt } from "@/app/nalog/avatarPromptAction";

/** Friendly, closable reminder to add a profile photo. Rendered only when shouldShowAvatarPrompt() is true. */
export function AvatarPrompt({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label="Dodajte profilnu sliku"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-burgundy-soft px-5 py-4 text-sm text-burgundy ${className}`}
    >
      <p className="min-w-0 flex-1">Dodajte profilnu sliku, da vas salon lakše prepozna kad dođete.</p>
      <div className="flex items-center gap-2">
        <Link href="/nalog/profil" className="btn-primary btn-sm">
          Dodaj sliku
        </Link>
        <form action={snoozeAvatarPrompt}>
          <button className="btn-ghost btn-sm">Kasnije</button>
        </form>
      </div>
    </section>
  );
}
