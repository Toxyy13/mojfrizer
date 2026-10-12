import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Display: Bricolage Grotesque (variable width and weight, used for the big animated wordmark).
// Body: Plus Jakarta Sans. Both ship latin-ext, so š, ž, č, ć, đ render natively.
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  axes: ["opsz", "wdth"],
});
const body = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "mojfrizer · zakažite frizera online",
  description: "Pronađite frizerski salon i zakažite termin za par sekundi, bez poziva.",
};

export const viewport: Viewport = {
  themeColor: "#f8f4ee",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sr-Latn" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-cream font-sans text-charcoal antialiased">{children}</body>
    </html>
  );
}
