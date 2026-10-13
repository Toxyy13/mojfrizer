// Cookie/map consent kept in one first-party cookie. Essential cookies (login) need no consent.
export const CONSENT_COOKIE = "mf_consent";
export const CONSENT_EVENT = "mf-consent-change";
export type ConsentChoice = "all" | "essential";

export function readConsent(): ConsentChoice | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(all|essential)`));
  return match ? (match[1] as ConsentChoice) : null;
}

export function saveConsent(choice: ConsentChoice): void {
  document.cookie = `${CONSENT_COOKIE}=${choice}; path=/; max-age=${180 * 24 * 3600}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
