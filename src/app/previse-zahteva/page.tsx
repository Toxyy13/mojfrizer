import type { Metadata } from "next";
import { ErrorPanel } from "@/components/ErrorPanel";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = { title: "Previše zahteva · mojfrizer", robots: { index: false } };

/** 429: shown (by a rewrite from the rate limiter) when too many requests came in a short time. */
export default function TooManyRequestsPage() {
  return (
    <>
      <ErrorPanel code="429" title="Malo sporije" bar>
        <p>Poslato je previše zahteva za kratko vreme. Sačekajte minut-dva pa pokušajte ponovo.</p>
      </ErrorPanel>
      <SiteFooter />
    </>
  );
}
