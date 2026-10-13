import { z } from "zod";
import { db, systemDb } from "./db";
import { addMessage } from "./chat";
import { createUrgentRequest } from "./urgent";
import { formatRsd } from "./money";
import { isValidDateIso } from "./time";
import { MAX_SERVICES_PER_VISIT } from "./visit";

export const urgentChatSchema = z.object({
  serviceIds: z.array(z.string().min(1)).min(1, "Izaberite uslugu").max(MAX_SERVICES_PER_VISIT),
  workerId: z.string().min(1).nullable(),
  dateIso: z.string().refine(isValidDateIso, "Neispravan datum"),
  timeWish: z.string().trim().max(80).default(""),
  reason: z.string().trim().min(5, "Napišite ukratko zašto je hitno").max(300),
});

export type UrgentChatInput = z.infer<typeof urgentChatSchema>;

export type UrgentChatResult = { ok: true } | { ok: false; error: string };

/**
 * "Hitna rezervacija": a logged-in customer opens the chat with the salon, with the urgent request as first message.
 * The UrgentRequest record is created too, so the owner's "Hitni zahtevi" panel can still record the swap and surcharge.
 * A customer with an open urgent request in this salon just returns to that chat.
 */
export async function startUrgentChat(
  salonId: string,
  customer: { id: string; name: string; phone: string | null },
  input: UrgentChatInput,
): Promise<UrgentChatResult> {
  const open = await systemDb.urgentRequest.findFirst({
    where: { salonId, clientId: customer.id, status: "PENDING" },
    select: { id: true },
  });
  if (open) return { ok: true };

  if (input.workerId) {
    const worker = await systemDb.workerProfile.findFirst({
      where: { id: input.workerId, salonId, isActive: true },
      select: { id: true },
    });
    if (!worker) return { ok: false, error: "Izabrani frizer nije pronađen." };
  }
  const created = await createUrgentRequest(
    salonId,
    {
      serviceIds: input.serviceIds,
      dateIso: input.dateIso,
      clientName: customer.name,
      clientPhone: customer.phone ?? "",
      reason: input.reason,
    },
    customer.id,
    { workerId: input.workerId, timeWish: input.timeWish || null },
  );
  if (!created.ok) return created;

  const [services, worker, salon] = await Promise.all([
    systemDb.service.findMany({ where: { salonId, id: { in: input.serviceIds } }, orderBy: { name: "asc" } }),
    input.workerId ? systemDb.workerProfile.findUnique({ where: { id: input.workerId }, select: { displayName: true } }) : null,
    systemDb.salon.findUnique({ where: { id: salonId }, select: { urgentSurcharge: true } }),
  ]);
  const lines = [
    "HITNA REZERVACIJA",
    `Usluga: ${services.map((s) => s.name).join(" + ")}`,
    `Frizer: ${worker?.displayName ?? "Bilo ko"}`,
    `Dan: ${input.dateIso.split("-").reverse().join(".")}${input.timeWish ? `, ${input.timeWish}` : ""}`,
    `Razlog: ${input.reason}`,
  ];
  if (salon && salon.urgentSurcharge > 0) lines.push(`Doplata za hitan termin: ${formatRsd(salon.urgentSurcharge)}`);
  await addMessage({ salonId, clientId: customer.id, senderId: customer.id, fromSalon: false, text: lines.join("\n") });
  return { ok: true };
}

/** Clients whose conversation this staff login may open: those with an open urgent request for them or for anyone. */
export async function urgentClientIdsForStaff(salonId: string, workerId: string): Promise<string[]> {
  const rows = await db.urgentRequest.findMany({
    where: { salonId, status: "PENDING", clientId: { not: null }, OR: [{ workerId: null }, { workerId }] },
    select: { clientId: true },
  });
  return [...new Set(rows.flatMap((r) => (r.clientId ? [r.clientId] : [])))];
}
