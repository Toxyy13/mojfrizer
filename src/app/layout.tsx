import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Fraunces renders Serbian diacritics (š, ć, ž) cleanly at display sizes.
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
});
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "mojfrizer · zakažite frizera online",
  description: "Pronađite frizerski salon i zakažite termin za par sekundi, bez poziva.",
};

export const viewport: Viewport = {
  themeColor: "#f8f4ee",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sr-Latn" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh bg-cream font-sans text-charcoal antialiased">{children}</body>
    </html>
  );
}
