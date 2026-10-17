// Prices are stored as integers in para (1 RSD = 100 para).
export function rsdToPara(rsd: number): number {
  return Math.round(rsd * 100);
}

export function formatRsd(para: number): string {
  return `${new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 0 }).format(para / 100)} RSD`;
}

/** Price-list label: free services show as "Gratis". */
export function formatPrice(para: number): string {
  return para === 0 ? "Gratis" : formatRsd(para);
}

/** Price-list label including a lower price when booked together with another service. */
export function formatServicePrice(service: { price: number; comboPrice: number | null }): string {
  const base = formatPrice(service.price);
  if (service.comboPrice === null || service.comboPrice >= service.price) return base;
  const combo = service.comboPrice === 0 ? "gratis" : formatRsd(service.comboPrice);
  return `${base}, ${combo} uz drugu uslugu`;
}
