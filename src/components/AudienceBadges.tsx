import type { Audience } from "@prisma/client";
import { AUDIENCES, AUDIENCE_LABELS, AUDIENCE_STYLES } from "@/lib/audience";

// What a salon works with. The meaning is always in the word; the color only helps scanning.
export function AudienceBadges({ audiences, className = "" }: { audiences: readonly Audience[]; className?: string }) {
  const shown = AUDIENCES.filter((a) => audiences.includes(a));
  if (shown.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Vrsta frizera">
      {shown.map((a) => (
        <li key={a} className={`badge gap-1.5 ${AUDIENCE_STYLES[a]}`}>
          <span aria-hidden className="size-2 rounded-full bg-current" />
          {AUDIENCE_LABELS[a]}
        </li>
      ))}
    </ul>
  );
}
