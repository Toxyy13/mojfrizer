// The "cena uz drugu uslugu" rule, shared by the server and the booking form's live summary.

export interface ComboItem {
  price: number;
  comboPrice: number | null;
}

/**
 * Price charged for each service of one visit (same customer, same day), in the order given.
 * A service with comboPrice is charged that price when the visit has another service that is paid in full.
 * Services without comboPrice always pay in full. When every service has a comboPrice, the most expensive
 * one pays in full, so a visit never becomes free just because each service is "gratis uz drugu uslugu".
 */
export function comboRulePrices(items: readonly ComboItem[]): number[] {
  if (items.length < 2) return items.map((s) => s.price);
  const allDiscounted = items.every((s) => s.comboPrice !== null);
  let anchor = -1;
  if (allDiscounted) {
    anchor = 0;
    items.forEach((s, i) => {
      if (s.price > items[anchor].price) anchor = i;
    });
  }
  return items.map((s, i) => (s.comboPrice === null || i === anchor ? s.price : Math.min(s.comboPrice, s.price)));
}
