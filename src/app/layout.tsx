import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Sora } from "next/font/google";
import { CookieBanner } from "@/components/CookieBanner";
import { appUrl } from "@/lib/appUrl";
import "./globals.css";

// Headings: Sora (geometric, modern). Body: Manrope. Both ship latin-ext, so š, ž, č, ć, đ render natively.
const display = Sora({ subsets: ["latin", "latin-ext"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-body" });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  alternates: { canonical: "./" },
  title: "mojfrizer · zakažite frizera online",
  description: "Pronađite frizerski salon i zakažite termin u par klikova, bez poziva.",
};

export const viewport: Viewport = {
  themeColor: "#f6f2ea",
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
