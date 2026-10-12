interface MarqueeProps {
  items: string[];
}

/** Endless horizontal ticker. Content is duplicated so the loop is seamless; the copy is hidden from screen readers. */
export function Marquee({ items }: MarqueeProps) {
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
    <div className="overflow-hidden border-y border-line bg-white py-5 font-serif text-2xl font-semibold tracking-tight sm:text-4xl">
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
