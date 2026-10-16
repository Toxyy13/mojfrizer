"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Wraps the hero and feeds the pointer position to the CSS spotlight. Does nothing on touch screens. */
export function HeroSpotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    const letters = Array.from(el.querySelectorAll<HTMLElement>(".wordmark-letter"));
    const RADIUS = 1.1; // in letter heights
    const reach = (e: PointerEvent, l: HTMLElement): number => {
      const r = l.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const t = 1 - Math.hypot(dx, dy) / (r.height * RADIUS);
      return Math.min(1, Math.max(0, t * t * (3 - 2 * t)));
    };
    const onMove = (e: PointerEvent): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        for (const l of letters) l.style.setProperty("--k", reach(e, l).toFixed(3));
      });
    };
    const onLeave = (): void => {
      cancelAnimationFrame(frame);
      for (const l of letters) l.style.setProperty("--k", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={ref} className={`spotlight ${className}`}>
      {children}
    </div>
  );
}
