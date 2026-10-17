export function Stat({ label, value, hint, warn = false }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="bg-white p-5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-serif text-2xl tabular-nums ${warn ? "text-burgundy" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
