import { Audience } from "@prisma/client";

// Which customers a salon works with. Shown as badges and used as a search filter.
export const AUDIENCES = [Audience.MEN, Audience.WOMEN, Audience.KIDS] as const;

export const AUDIENCE_LABELS: Record<Audience, string> = { MEN: "Muški", WOMEN: "Ženski", KIDS: "Dečiji" };

// Static class names so Tailwind sees them: soft background, dark text, dot in the text color.
export const AUDIENCE_STYLES: Record<Audience, string> = {
  MEN: "bg-men-soft text-men",
  WOMEN: "bg-women-soft text-women",
  KIDS: "bg-kids-soft text-kids",
};

// Same colors for a checked picker chip.
export const AUDIENCE_PICKED: Record<Audience, string> = {
  MEN: "has-[:checked]:border-men has-[:checked]:bg-men-soft has-[:checked]:text-men",
  WOMEN: "has-[:checked]:border-women has-[:checked]:bg-women-soft has-[:checked]:text-women",
  KIDS: "has-[:checked]:border-kids has-[:checked]:bg-kids-soft has-[:checked]:text-kids",
};

/** Keeps only known values, in the fixed order; accepts form or query values. */
export function parseAudiences(values: ReadonlyArray<FormDataEntryValue | string | undefined | null>): Audience[] {
  return AUDIENCES.filter((a) => values.includes(a));
}

/** Search words that find a salon by what it does ("muški", "deciji"...), for text search. */
export function audienceWords(audiences: readonly Audience[]): string {
  return audiences.map((a) => AUDIENCE_LABELS[a]).join(" ");
}
