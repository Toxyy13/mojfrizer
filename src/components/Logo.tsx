import Link from "next/link";

interface LogoProps {
  href?: string;
  className?: string;
  dark?: boolean;
}

/** Wordmark with a small spinning barber pole. */
export function Logo({ href = "/", className = "", dark = false }: LogoProps) {
  return (
    <Link href={href} className={`group inline-flex min-h-11 items-center gap-2 font-serif text-[26px] leading-none tracking-tight ${className}`} aria-label="mojfrizer, početna">
      <span aria-hidden className="pole h-7 w-3.5 shrink-0 ring-1 ring-charcoal/20 [animation-duration:1.2s] group-hover:[animation-duration:0.5s]" />
      <span>
        <span className={`font-bold uppercase ${dark ? "text-cream" : ""}`}>moj</span>
        <span className={`font-normal uppercase ${dark ? "text-[#f08a7e]" : "text-burgundy"}`}>frizer</span>
      </span>
    </Link>
  );
}
