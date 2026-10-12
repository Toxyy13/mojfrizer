// Prices are stored as integers in para (1 RSD = 100 para).
export function rsdToPara(rsd: number): number {
  return Math.round(rsd * 100);
}

export function formatRsd(para: number): string {
  const rsd = para / 100;
  return `${new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 0 }).format(rsd)} RSD`;
}
