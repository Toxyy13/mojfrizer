"use client";

import { useState } from "react";

interface MarqueeProps {
  items: string[];
}

/** Endless horizontal ticker. Content is duplicated so the loop is seamless; the copy is hidden from screen readers. */
export function Marquee({ items }: MarqueeProps) {
  const [paused, setPaused] = useState(false);
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item} className="flex items-center gap-10 whitespace-nowrap">
          {item}
          <span aria-hidden className="size-2 rotate-45 bg-burgundy" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden border-y border-line bg-white py-5 font-serif text-2xl font-semibold tracking-tight sm:text-4xl">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]" style={paused ? { animationPlayState: "paused" } : undefined}>
        {row(false)}
        {row(true)}
      </div>
      {/* Moving text must be stoppable (WCAG 2.2.2). */}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-line bg-white px-3 py-1.5 font-sans text-xs font-medium tracking-normal text-charcoal shadow-sm hover:border-charcoal"
      >
        {paused ? "Pokreni traku" : "Zaustavi traku"}
      </button>
    </div>
  );
}
