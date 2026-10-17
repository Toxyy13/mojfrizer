import type { AppointmentStatus } from "@prisma/client";

/** Appointment status as the customer reads it. */
export const CLIENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  BOOKED: "Zakazano",
  COMPLETED: "Završeno",
  CANCELLED: "Otkazano",
  NO_SHOW: "Niste došli",
};
