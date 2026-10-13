"use client";

import { useEffect, useState } from "react";

interface StickyBookBarProps {
  /** Id of the booking section; the bar hides while it is on screen. */
  targetId: string;
  label: string;
  hint?: string;
  /** Optional second button, e.g. the urgent booking. */
  secondaryHref?: string;
  secondaryLabel?: string;
}

/** Thumb-reachable "book" button on phones, hidden on desktop and when the form is already visible. */
export function StickyBookBar({ targetId, label, hint, secondaryHref, secondaryLabel }: StickyBookBarProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { rootMargin: "0px 0px -30% 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-transform duration-300 md:hidden ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
      aria-hidden={hidden}
    >
      <div className="flex items-center gap-3">
        {hint && <p className="min-w-0 flex-1 truncate text-sm text-muted">{hint}</p>}
        <a href={`#${targetId}`} tabIndex={hidden ? -1 : 0} className={`btn-primary ${hint ? "shrink-0" : "w-full"}`}>
          {label}
        </a>
        {secondaryHref && secondaryLabel && (
          <a href={secondaryHref} tabIndex={hidden ? -1 : 0} className="btn-secondary shrink-0">
            {secondaryLabel}
          </a>
        )}
      </div>
    </div>
  );
}
