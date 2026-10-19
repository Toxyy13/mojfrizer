import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, systemDb } from "./db";
import type { SessionUser } from "./auth";
import { secretKey } from "./sessionToken";
import { createAppointment, getAvailableSlots, salonBookingInputSchema } from "./booking";
import { MAX_ACTIVE_ONLINE_BOOKINGS, checkVisitorLimits, countActiveOnlineBookings } from "./bookingGuard";
import { isBlockedOnline } from "./clients";
import { applyComboPricing } from "./comboPricing";
import { appointmentWhenFormat, cancelByCustomer, moveBooking, rescheduleByCustomer, sendBookingConfirmation } from "./manageBooking";
import { formatRsd, rsdToPara } from "./money";
import { MAX_DAYS_OFF_RANGE } from "./salonSettings";
import { TIME_ZONE, WEEKDAYS_SR, addDaysIso, formatDateSr, formatLocalDateIso, isValidDateIso, localToUtc, minutesToHHMM } from "./time";
import { notifyWaitlist } from "./waitlist";
import { MAX_SERVICES_PER_VISIT, appointmentServicesInclude, resolveVisit, servicesLabel } from "./visit";

// Things the voice/text assistant may do on someone's behalf. The model only PROPOSES an action; the person
// confirms it with a button, and only then is the signed proposal executed with the same checks as the website forms.

const dateIso = z.string().refine(isValidDateIso, "Neispravan datum");
const minute = z.number().int().min(0).max(24 * 60);
const serviceIds = z.array(z.string().min(1)).min(1).max(MAX_SERVICES_PER_VISIT);

export const actionSchema = z.discriminatedUnion("type", [
  // Customer (logged in, on a salon page): only their own bookings.
  z.object({ type: z.literal("book"), serviceIds, dateIso, minute }),
  z.object({ type: z.literal("cancel_mine"), appointmentId: z.string().min(1) }),
  z.object({ type: z.literal("move_mine"), appointmentId: z.string().min(1), dateIso, minute }),
  // Salon owner: only their own salon.
  z.object({
    type: z.literal("salon_book"),
    serviceIds,
    dateIso,
    minute,
    clientName: z.string().trim().min(2).max(80),
    clientPhone: z.string().trim().max(20).optional().nullable(),
    workerId: z.string().optional().nullable(),
  }),
  z.object({ type: z.literal("salon_status"), appointmentId: z.string().min(1), status: z.enum(["CANCELLED", "COMPLETED", "NO_SHOW"]) }),
  z.object({ type: z.literal("salon_move"), appointmentId: z.string().min(1), dateIso, minute }),
  z.object({
    type: z.literal("set_service"),
    serviceId: z.string().min(1),
    priceRsd: z.number().min(0).max(1_000_000).optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("set_hours"),
    weekday: z.number().int().min(1).max(7),
    opensAt: minute.nullable(),
    closesAt: minute.nullable(),
  }),
  z.object({ type: z.literal("add_days_off"), from: dateIso, to: dateIso.optional(), reason: z.string().trim().max(80).optional() }),
  z.object({
    type: z.literal("add_break"),
    workerId: z.string().min(1),
    startMinute: minute,
    endMinute: minute,
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    dateIso: dateIso.optional(),
    label: z.string().trim().max(60).optional(),
  }),
]);

export type AssistantAction = z.infer<typeof actionSchema>;

export interface ActionContext {
  user: SessionUser;
  salon: { id: string; slug: string; name: string };
}

export type PrepareResult = { ok: true; action: AssistantAction; summary: string } | { ok: false; error: string };
export type RunResult = { ok: true; message: string } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const when = (dateStr: string, m: number): string => `${formatDateSr(dateStr)} u ${minutesToHHMM(m)}`;

// --- signed proposals -------------------------------------------------------------------------------------------

const PROPOSAL_MINUTES = 5;
// A separate key, so a proposal can never be used as a login cookie.
const proposalKey = (): Uint8Array => createHash("sha256").update(secretKey()).update("assistant-action").digest();

export async function signProposal(ctx: ActionContext, action: AssistantAction): Promise<string> {
  return new SignJWT({ action, salonId: ctx.salon.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ctx.user.id)
    .setJti(randomUUID())
    .setExpirationTime(`${PROPOSAL_MINUTES}m`)
    .sign(proposalKey());
}

/** The action and its one-time id, when the token is genuine, fresh and was issued to this user for this salon. */
export async function verifyProposal(token: string, ctx: ActionContext): Promise<{ action: AssistantAction; jti: string } | null> {
  try {
    const { payload } = await jwtVerify(token, proposalKey(), { algorithms: ["HS256"] });
    const action = actionSchema.safeParse(payload.action);
    if (!action.success || !payload.jti || payload.sub !== ctx.user.id || payload.salonId !== ctx.salon.id) return null;
    return { action: action.data, jti: payload.jti };
  } catch {
    return null;
  }
}

// --- preparing (validate + describe) ------------------------------------------------------------------------------

async function slotFree(salonId: string, ids: string[], dateStr: string, m: number, enforceLeadTime: boolean): Promise<string | null> {
  const visit = await resolveVisit(salonId, ids);
  if (!visit) return "Usluga nije pronađena.";
  const slots = await getAvailableSlots({ salonId, durationMinutes: visit.durationMinutes, dateIso: dateStr, enforceLeadTime });
  return slots.some((s) => s.minute === m) ? null : "Taj termin nije slobodan.";
}

async function servicesText(salonId: string, ids: string[]): Promise<string> {
  const visit = await resolveVisit(salonId, ids);
  return visit ? visit.services.map((s) => s.name).join(" + ") : "";
}

async function ownAppointment(ctx: ActionContext, id: string, owner: boolean) {
  const a = await systemDb.appointment.findFirst({
    where: { id, status: "BOOKED", ...(owner ? { salonId: ctx.salon.id } : { clientId: ctx.user.id }) },
    include: { ...appointmentServicesInclude, service: true, client: { select: { name: true } }, salon: { select: { name: true } } },
  });
  if (!a) return null;
  const who = a.guestName ?? a.client?.name ?? "mušterija";
  return { a, label: `${who}, ${appointmentWhenFormat.format(a.startTime)}, ${servicesLabel(a)}` };
}

/** Checks a proposed action against the person's rights and the real data, and words it for the confirmation card. */
export async function prepareAction(ctx: ActionContext, raw: unknown, owner: boolean): Promise<PrepareResult> {
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return fail("Neispravni podaci za radnju.");
  const action = parsed.data;
  const salonId = ctx.salon.id;
  const ownerOnly = !["book", "cancel_mine", "move_mine"].includes(action.type);
  if (ownerOnly !== owner) return fail("Ova radnja nije dozvoljena.");
  const ok = (summary: string): PrepareResult => ({ ok: true, action, summary });

  switch (action.type) {
    case "book":
    case "salon_book": {
      const taken = await slotFree(salonId, action.serviceIds, action.dateIso, action.minute, action.type === "book");
      if (taken) return fail(taken);
      const text = await servicesText(salonId, action.serviceIds);
      const who = action.type === "salon_book" ? ` za ${action.clientName}` : "";
      return ok(`Zakazati${who}: ${text}, ${when(action.dateIso, action.minute)} (${ctx.salon.name})`);
    }
    case "cancel_mine":
    case "salon_status": {
      const found = await ownAppointment(ctx, action.appointmentId, owner);
      if (!found) return fail("Termin nije pronađen.");
      const verb = action.type === "cancel_mine" || action.status === "CANCELLED" ? "Otkazati" : action.status === "COMPLETED" ? "Označiti kao završen" : "Označiti kao „nije došao”";
      return ok(`${verb}: ${found.label}`);
    }
    case "move_mine":
    case "salon_move": {
      const found = await ownAppointment(ctx, action.appointmentId, owner);
      if (!found) return fail("Termin nije pronađen.");
      return ok(`Pomeriti: ${found.label} → ${when(action.dateIso, action.minute)}`);
    }
    case "set_service": {
      const s = await db.service.findFirst({ where: { id: action.serviceId, salonId } });
      if (!s) return fail("Usluga nije pronađena.");
      const parts = [
        action.priceRsd !== undefined && `cena ${formatRsd(s.price)} → ${formatRsd(rsdToPara(action.priceRsd))}`,
        action.durationMinutes !== undefined && `trajanje ${s.durationMinutes} → ${action.durationMinutes} min`,
        action.active !== undefined && (action.active ? "vratiti u cenovnik" : "sklonuti iz cenovnika"),
      ].filter(Boolean);
      return parts.length ? ok(`Usluga „${s.name}”: ${parts.join(", ")}`) : fail("Nema šta da se menja.");
    }
    case "set_hours": {
      const closed = action.opensAt === null || action.closesAt === null;
      if (!closed && action.opensAt! >= action.closesAt!) return fail("Početak mora biti pre kraja radnog vremena.");
      const day = WEEKDAYS_SR[action.weekday];
      return ok(closed ? `${day}: salon ne radi` : `${day}: radno vreme ${minutesToHHMM(action.opensAt!)}-${minutesToHHMM(action.closesAt!)}`);
    }
    case "add_days_off": {
      const to = action.to ?? action.from;
      if (to < action.from) return fail("Kraj mora biti posle početka.");
      if (addDaysIso(action.from, MAX_DAYS_OFF_RANGE) < to) return fail(`Najviše ${MAX_DAYS_OFF_RANGE} dana odjednom.`);
      const range = to === action.from ? formatDateSr(action.from) : `${formatDateSr(action.from)} do ${formatDateSr(to)}`;
      return ok(`Neradni dan: ${range}${action.reason ? ` (${action.reason})` : ""}`);
    }
    case "add_break": {
      const w = await db.workerProfile.findFirst({ where: { id: action.workerId, salonId }, select: { displayName: true } });
      if (!w) return fail("Frizer nije pronađen.");
      if (action.startMinute >= action.endMinute) return fail("Početak pauze mora biti pre kraja.");
      if (!action.dateIso && !action.weekdays?.length) return fail("Treba datum ili dani u nedelji.");
      const days = action.dateIso ? formatDateSr(action.dateIso) : action.weekdays!.map((d) => WEEKDAYS_SR[d]).join(", ");
      return ok(`Pauza za ${w.displayName}: ${minutesToHHMM(action.startMinute)}-${minutesToHHMM(action.endMinute)}, ${days}${action.label ? ` (${action.label})` : ""}`);
    }
  }
}

// --- running ---------------------------------------------------------------------------------------------------

function refresh(slug: string): void {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/s/${slug}`);
}

/** Runs a confirmed action. Re-checks everything, because the data may have changed since the proposal. */
export async function runAction(ctx: ActionContext, action: AssistantAction, owner: boolean): Promise<RunResult> {
  const prepared = await prepareAction(ctx, action, owner);
  if (!prepared.ok) return prepared;
  const salonId = ctx.salon.id;
  const done = (message: string): RunResult => {
    refresh(ctx.salon.slug);
    return { ok: true, message };
  };

  switch (action.type) {
    case "book": {
      const phone = (await systemDb.user.findUnique({ where: { id: ctx.user.id }, select: { phone: true } }))?.phone ?? null;
      const limited = await checkVisitorLimits("book", phone);
      if (limited) return fail(limited);
      if ((await countActiveOnlineBookings(salonId, phone, ctx.user.id)) >= MAX_ACTIVE_ONLINE_BOOKINGS) {
        return fail("Već imate više zakazanih termina u ovom salonu. Pozovite salon za dodatni termin.");
      }
      if (await isBlockedOnline(salonId, { guestPhone: phone, clientId: ctx.user.id })) return fail("Za ovaj termin pozovite salon telefonom.");
      const r = await createAppointment(
        salonId,
        { serviceIds: action.serviceIds, dateIso: action.dateIso, minute: action.minute, clientName: ctx.user.name, clientPhone: phone },
        { source: "ONLINE", createdById: ctx.user.id, clientId: ctx.user.id },
      );
      if (!r.ok) return r;
      await sendBookingConfirmation(r.appointmentId);
      return done(`Termin je zakazan: ${when(action.dateIso, action.minute)}.`);
    }
    case "cancel_mine": {
      const found = await ownAppointment(ctx, action.appointmentId, false);
      const r = found ? await cancelByCustomer(found.a.manageToken) : fail("Termin nije pronađen.");
      return r.ok ? done("Termin je otkazan.") : r;
    }
    case "move_mine": {
      const found = await ownAppointment(ctx, action.appointmentId, false);
      const r = found ? await rescheduleByCustomer(found.a.manageToken, action.dateIso, action.minute) : fail("Termin nije pronađen.");
      return r.ok ? done("Termin je pomeren.") : r;
    }
    case "salon_book": {
      const input = salonBookingInputSchema.safeParse({ ...action, note: null });
      if (!input.success) return fail(input.error.issues[0]?.message ?? "Neispravni podaci");
      const r = await createAppointment(salonId, input.data, { source: "SALON", createdById: ctx.user.id, clientId: null });
      return r.ok ? done(`Termin je upisan: ${when(action.dateIso, action.minute)}.`) : r;
    }
    case "salon_status": {
      await db.$transaction(async (tx) => {
        const { count } = await tx.appointment.updateMany({ where: { id: action.appointmentId, salonId }, data: { status: action.status } });
        if (count > 0) await applyComboPricing(tx, action.appointmentId);
      });
      if (action.status === "CANCELLED") {
        const a = await db.appointment.findFirst({ where: { id: action.appointmentId, salonId }, select: { startTime: true } });
        if (a) await notifyWaitlist(salonId, formatLocalDateIso(a.startTime, TIME_ZONE));
      }
      return done("Termin je ažuriran.");
    }
    case "salon_move": {
      const found = await ownAppointment(ctx, action.appointmentId, true);
      const r = found
        ? await moveBooking(found.a, action.dateIso, action.minute, { enforceLeadTime: false, onlyWorkerId: null })
        : fail("Termin nije pronađen.");
      return r.ok ? done("Termin je pomeren.") : r;
    }
    case "set_service": {
      const data = {
        ...(action.priceRsd !== undefined && { price: rsdToPara(action.priceRsd) }),
        ...(action.durationMinutes !== undefined && { durationMinutes: action.durationMinutes }),
        ...(action.active !== undefined && { isActive: action.active }),
      };
      await db.service.updateMany({ where: { id: action.serviceId, salonId }, data });
      return done("Usluga je izmenjena.");
    }
    case "set_hours": {
      const open = action.opensAt !== null && action.closesAt !== null;
      await db.$transaction([
        db.workingHours.deleteMany({ where: { salonId, dayOfWeek: action.weekday } }),
        ...(open ? [db.workingHours.create({ data: { salonId, dayOfWeek: action.weekday, opensAt: action.opensAt!, closesAt: action.closesAt! } })] : []),
      ]);
      return done("Radno vreme je sačuvano. Već zakazani termini ostaju.");
    }
    case "add_days_off": {
      const to = action.to ?? action.from;
      const dates: string[] = [];
      for (let d = action.from; d <= to; d = addDaysIso(d, 1)) dates.push(d);
      await db.salonDayOff.createMany({
        data: dates.map((d) => ({ salonId, date: new Date(`${d}T00:00:00Z`), reason: action.reason || null })),
        skipDuplicates: true,
      });
      const booked = await db.appointment.count({
        where: { salonId, status: "BOOKED", startTime: { gte: localToUtc(action.from, 0, TIME_ZONE), lt: localToUtc(addDaysIso(to, 1), 0, TIME_ZONE) } },
      });
      return done(booked > 0 ? `Dodato. Pažnja: tih dana već ima ${booked} zakazanih termina, javite se tim mušterijama.` : "Neradni dani su dodati.");
    }
    case "add_break": {
      await db.workerBreak.create({
        data: {
          salonId,
          workerId: action.workerId,
          startMinute: action.startMinute,
          endMinute: action.endMinute,
          weekdays: action.dateIso ? [] : [...new Set(action.weekdays)].sort(),
          date: action.dateIso ? new Date(`${action.dateIso}T00:00:00Z`) : null,
          label: action.label || null,
        },
      });
      return done("Pauza je dodata. Već zakazani termini u pauzi nisu otkazani.");
    }
  }
}
