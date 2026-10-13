import Link from "next/link";
import { MIN_AGE } from "@/lib/company";

/** Label of the unchecked sign-up checkbox. Links open in a new tab so the form isn't lost. */
export function TermsLabel() {
  return (
    <>
      Imam najmanje {MIN_AGE} godina i prihvatam{" "}
      <Link href="/uslovi" target="_blank" className="link">
        Uslove korišćenja
      </Link>{" "}
      i{" "}
      <Link href="/privatnost" target="_blank" className="link">
        Politiku privatnosti
      </Link>
      .
    </>
  );
}
