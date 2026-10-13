import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/core";
import { scrubEvent, scrubString, sentryOptions } from "../sentryScrub";

describe("scrubString", () => {
  it("hides emails, phones and tokens", () => {
    const out = scrubString("Greška za ana@primer.rs, tel +381 64 123 4567 / 0641234567, link /termin/abcdefghijklmnopqrstuvwxyz12?x=1");
    expect(out).not.toMatch(/ana@/);
    expect(out).not.toMatch(/123 4567|0641234567/);
    expect(out).not.toMatch(/abcdefghijklmnop/);
    expect(out).toContain("/termin/[token]");
  });

  it("hides session JWTs", () => {
    expect(scrubString("jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJl end")).toBe("jwt [token] end");
  });

  it("keeps ordinary error text readable", () => {
    expect(scrubString("Unique constraint failed on appointments_no_overlap")).toBe("Unique constraint failed on appointments_no_overlap");
  });
});

describe("scrubEvent", () => {
  it("drops user, cookies, headers, bodies and extra data", () => {
    const event = {
      type: undefined,
      user: { id: "u1", email: "a@b.rs", ip_address: "1.2.3.4" },
      extra: { body: "poruka salonu" },
      server_name: "host",
      request: {
        url: "https://mojfrizer.com/nova-lozinka?token=secrettokensecrettokensecret",
        method: "POST",
        cookies: { mf_session: "x" },
        headers: { cookie: "mf_session=x" },
        data: { password: "tajna123" },
        query_string: "token=abc",
      },
      breadcrumbs: [{ message: "fetch ana@primer.rs", data: { url: "/x", body: "tajna" } }],
      exception: { values: [{ type: "Error", value: "Nalog ana@primer.rs nije pronađen" }] },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.user).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.request).toEqual({ url: "https://mojfrizer.com/nova-lozinka", method: "POST" });
    expect(JSON.stringify(out)).not.toMatch(/ana@|tajna|mf_session|secrettoken/);
  });
});

describe("sentryOptions", () => {
  it("stays off without a DSN and never traces by default", () => {
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
    const options = sentryOptions();
    expect(options.dsn).toBeUndefined();
    expect(options.tracesSampleRate).toBe(0);
    expect(options.sendDefaultPii).toBe(false);
  });
});
