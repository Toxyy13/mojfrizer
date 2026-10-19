/** Dashed cut line; the scissors travel along it as it scrolls into view and snip while moving. */
export function ScissorsLine({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`cut-line relative mt-8 h-0 ${className}`}>
      <svg viewBox="0 0 24 24" className="scissors-run absolute -top-4 left-0 size-8 bg-cream text-charcoal" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M8.1 8.1 20 20M8.1 15.9 20 4" />
      </svg>
    </div>
  );
}
