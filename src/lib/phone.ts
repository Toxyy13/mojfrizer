// Serbian phone numbers, stored as +381XXXXXXXX so "064 123 4567" and "+381 64 123 4567" match.

/** Returns the normalized number, or null when the input is not a plausible Serbian phone number. */
export function normalizePhone(input: string): string | null {
  let digits = input.trim().replace(/[\s\-/().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `381${digits.slice(1)}`;
  if (!/^381\d{8,10}$/.test(digits)) return null;
  return `+${digits}`;
}

/** Heuristic used by the login form: anything with an @ is an email. */
export function looksLikeEmail(input: string): boolean {
  return input.includes("@");
}

/** +381641234567 -> 064 123 4567, for display. */
export function formatPhone(normalized: string): string {
  const local = normalized.startsWith("+381") ? `0${normalized.slice(4)}` : normalized;
  return local.replace(/^(\d{3})(\d{3})(\d+)$/, "$1 $2 $3");
}
