// Who runs mojfrizer.com. Shown on the legal pages and in the footer.
// Values in square brackets are placeholders until the owner sends the real business details.

export const COMPANY = {
  name: "[Naziv firme ili preduzetničke radnje]",
  address: "[Adresa sedišta]",
  pib: "[PIB]",
  registryNumber: "[Matični broj]",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "[email za kontakt]",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "[telefon za kontakt]",
  website: "mojfrizer.com",
} as const;

/** Date the current legal texts took effect. Bump it (and TERMS_VERSION) when they change. */
export const LEGAL_UPDATED = "12. oktobar 2026.";
export const TERMS_VERSION = "2026-10-12";

/** Serbian law (ZZPL, čl. 16) lets a person consent on their own from 15; younger users need a parent. */
export const MIN_AGE = 15;

export const isPlaceholder = (value: string): boolean => value.startsWith("[");

/** Legal pages linked from the footer and the side menu of each legal page. */
export const LEGAL_LINKS: Array<{ href: string; label: string }> = [
  { href: "/uslovi", label: "Uslovi korišćenja" },
  { href: "/privatnost", label: "Politika privatnosti" },
  { href: "/kolacici", label: "Kolačići" },
  { href: "/povracaj-novca", label: "Otkazivanje i povraćaj" },
  { href: "/brisanje-podataka", label: "Brisanje podataka" },
  { href: "/o-nama", label: "Podaci o firmi" },
  { href: "/licence", label: "Licence" },
];

