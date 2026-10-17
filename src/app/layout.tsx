import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { CookieBanner } from "@/components/CookieBanner";
import { appUrl } from "@/lib/appUrl";
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
  metadataBase: new URL(appUrl()),
  alternates: { canonical: "./" },
  title: "mojfrizer · zakažite frizera online",
  description: "Pronađite frizerski salon i zakažite termin u par klikova, bez poziva.",
};

export const viewport: Viewport = {
  themeColor: "#f8f4ee",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sr-Latn" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-cream font-sans text-charcoal antialiased"><a href="#sadrzaj" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-full focus:bg-burgundy focus:px-4 focus:py-2 focus:text-white">
          Preskoči na sadržaj
        </a>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
