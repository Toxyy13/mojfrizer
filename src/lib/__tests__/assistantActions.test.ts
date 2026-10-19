// The assistant only proposes; a proposal is signed, short-lived, tied to one user and one salon, and owner actions never reach customers.
import { describe, expect, it } from "vitest";

process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long!!";

const { prepareAction, signProposal, verifyProposal } = await import("../assistantActions");
const { afterWakeWord, speakable } = await import("../../components/useSpeech");

const user = { id: "u1", email: null, name: "Ana", role: "CLIENT" as const };
const ctx = { user, salon: { id: "s1", slug: "kod-olgice", name: "Kod Olgice" } };
const action = { type: "cancel_mine" as const, appointmentId: "a1" };

describe("signed proposals", () => {
  it("verifies for the same user and salon", async () => {
    const token = await signProposal(ctx, action);
    const proposal = await verifyProposal(token, ctx);
    expect(proposal?.action).toEqual(action);
    expect(proposal?.jti).toBeTruthy();
  });

  it("is refused for another user, another salon or a tampered token", async () => {
    const token = await signProposal(ctx, action);
    expect(await verifyProposal(token, { ...ctx, user: { ...user, id: "u2" } })).toBeNull();
    expect(await verifyProposal(token, { ...ctx, salon: { ...ctx.salon, id: "s2" } })).toBeNull();
    expect(await verifyProposal(`${token}x`, ctx)).toBeNull();
  });

  it("is not accepted from a forged payload", async () => {
    const forged = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: "u1", salonId: "s1", jti: "x", action })).toString("base64url") + ".";
    expect(await verifyProposal(forged, ctx)).toBeNull();
  });
});

describe("who may ask for which action", () => {
  it("a customer can't prepare owner actions", async () => {
    const r = await prepareAction(ctx, { type: "set_service", serviceId: "x", priceRsd: 1 }, false);
    expect(r).toEqual({ ok: false, error: "Ova radnja nije dozvoljena." });
  });

  it("an owner can't prepare customer actions", async () => {
    const r = await prepareAction(ctx, { type: "cancel_mine", appointmentId: "a1" }, true);
    expect(r).toEqual({ ok: false, error: "Ova radnja nije dozvoljena." });
  });

  it("rejects malformed actions", async () => {
    expect((await prepareAction(ctx, { type: "set_hours", weekday: 9, opensAt: 1, closesAt: 2 }, true)).ok).toBe(false);
    expect((await prepareAction(ctx, { type: "nope" }, true)).ok).toBe(false);
  });
});

describe("wake word and speech text", () => {
  it("finds Todor in a sentence and returns what follows", () => {
    expect(afterWakeWord("Todore, ima li slobodno sutra?")).toBe("ima li slobodno sutra?");
    expect(afterWakeWord("hej Todor")).toBe("");
    expect(afterWakeWord("Тодоре који је термин")).toBe("који је термин");
  });

  it("ignores other speech", () => {
    expect(afterWakeWord("kolika je cena šišanja")).toBeNull();
    expect(afterWakeWord("Todorović je došao")).toBeNull();
  });

  it("cleans text for the speaker", () => {
    expect(speakable("Kod Olgice /s/kod-olgice **radi** do 19:00 ✂️")).toBe("Kod Olgice radi do 19:00");
  });
});
