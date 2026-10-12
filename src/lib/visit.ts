import type { Prisma, Service, ServiceCombo } from "@prisma/client";
import { db } from "./db";

// Upper bound on services in one booking; keeps the slot search and the form sane.
export const MAX_SERVICES_PER_VISIT = 6;

export interface Visit {
  services: Service[]; // in price-list order; the first is the appointment's primary service
  durationMinutes: number;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((id, i) => id === sorted[i]);
}

/**
 * Duration of a set of services booked together: the salon's combo duration for exactly
 * this set when one is defined, otherwise the sum of the services' durations.
 */
export function visitDuration(
  services: Pick<Service, "id" | "durationMinutes">[],
  combos: Pick<ServiceCombo, "serviceIds" | "durationMinutes">[],
): number {
  const ids = services.map((s) => s.id);
  if (ids.length > 1) {
    const combo = combos.find((c) => sameSet(c.serviceIds, ids));
    if (combo) return combo.durationMinutes;
  }
  return services.reduce((sum, s) => sum + s.durationMinutes, 0);
}

/** Validates the chosen services for a salon and works out how long the visit takes. */
export async function resolveVisit(
  salonId: string,
  serviceIds: readonly string[],
  client: Prisma.TransactionClient = db,
): Promise<Visit | null> {
  const unique = [...new Set(serviceIds.filter(Boolean))];
  if (unique.length === 0 || unique.length > MAX_SERVICES_PER_VISIT) return null;
  const [services, combos] = await Promise.all([
    client.service.findMany({
      where: { id: { in: unique }, salonId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    client.serviceCombo.findMany({ where: { salonId } }),
  ]);
  if (services.length !== unique.length) return null;
  return { services, durationMinutes: visitDuration(services, combos) };
}

/** Price of each service in a visit: comboPrice applies when the visit has another service. */
export function visitItemPrices(
  services: Pick<Service, "id" | "price" | "comboPrice">[],
  hasOtherServiceElsewhere = false,
): number[] {
  return services.map((s) => {
    const hasOther = hasOtherServiceElsewhere || services.some((o) => o.id !== s.id);
    return s.comboPrice !== null && hasOther ? s.comboPrice : s.price;
  });
}

// Include for reading an appointment's services in order, with names.
export const appointmentServicesInclude = {
  services: { include: { service: true }, orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.AppointmentInclude;

interface WithServices {
  service: { name: string };
  services?: { service: { name: string } }[];
}

/** "Muško šišanje + Pranje kose"; falls back to the primary service for rows without items. */
export function servicesLabel(appointment: WithServices): string {
  const names = appointment.services?.map((i) => i.service.name) ?? [];
  return names.length > 0 ? names.join(" + ") : appointment.service.name;
}
