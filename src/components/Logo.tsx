import Link from "next/link";

interface LogoProps {
  href?: string;
  className?: string;
}

/** Wordmark: scissors-free, just type with a burgundy dot. */
export function Logo({ href = "/", className = "" }: LogoProps) {
  return (
    <Link href={href} className={`font-serif text-[26px] leading-none tracking-tight ${className}`} aria-label="mojfrizer, početna">
      moj<span className="italic">frizer</span>
      <span className="text-burgundy">.</span>
    </Link>
  );
}
