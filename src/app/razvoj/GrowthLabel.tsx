/** Month-over-month change: green when up, burgundy when down, a dash when there is nothing to compare. */
export function GrowthLabel({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  return <span className={value >= 0 ? "text-forest" : "text-burgundy"}>{value >= 0 ? "+" : ""}{value}%</span>;
}
