// Search without caring about case, diacritics or script: "nis", "Nis" and "Niš" (also "Ниш") all match "Niš".

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ђ: "d", е: "e", ж: "z", з: "z", и: "i", ј: "j", к: "k", л: "l", љ: "lj", м: "m",
  н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ћ: "c", у: "u", ф: "f", х: "h", ц: "c", ч: "c", џ: "dz", ш: "s",
};

/** Lowercase Latin form without diacritics; đ and dj both become d, dž becomes dz. */
export function fold(text: string): string {
  const latin = text
    .toLowerCase()
    .replace(/[а-яђјљњћџ]/g, (c) => CYRILLIC[c] ?? c)
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return latin.replace(/dj/g, "d").replace(/dz/g, "z");
}

/** True when every word of the query appears (folded) in one of the fields. */
export function matchesQuery(query: string, ...fields: Array<string | null | undefined>): boolean {
  const haystack = fields.map((f) => fold(f ?? "")).join(" ");
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
