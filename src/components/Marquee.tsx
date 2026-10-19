"use client";

import { useState } from "react";

interface MarqueeProps {
  items: string[];
}

/** Endless strip of text on a ribbon. Content is duplicated so the loop is seamless; the copy is hidden from screen readers. */
export function Marquee({ items }: MarqueeProps) {
  const [paused, setPaused] = useState(false);
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item} className="flex items-center gap-8 whitespace-nowrap">
          {item}
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-burgundy" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden bg-charcoal py-4 font-serif text-xl font-semibold tracking-tight text-cream sm:text-2xl">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]" style={paused ? { animationPlayState: "paused" } : undefined}>
        {row(false)}
        {row(true)}
      </div>
      {/* Moving text must be stoppable (WCAG 2.2.2). */}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg bg-paper px-3 py-2.5 font-sans text-xs font-semibold tracking-normal text-charcoal hover:bg-sand"
      >
        {paused ? "Pokreni traku" : "Zaustavi traku"}
      </button>
    </div>
  );
}
