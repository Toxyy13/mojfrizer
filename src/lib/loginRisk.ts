import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { secretKey } from "./sessionToken";

// First round of checks on a login request, before the password is looked at: no risk passes, risky needs a captcha,
// dangerous is refused. Add points here; the thresholds are the only tuning knobs.

export type Risk = "no_risk" | "risky" | "dangerous";

export interface LoginSignals {
  userAgent: string;
  /** The browser holds this account's device cookie. */
  knownDevice: boolean;
  /** Wrong passwords for this account in the current window. */
  accountFailures: number;
  /** Wrong passwords from this address, across all accounts, in the current window. */
  ipFailures: number;
  /** Developer accounts can change the whole platform, so they are judged more strictly. */
  developer: boolean;
}

const RISKY_FROM = 2;
const DANGEROUS_FROM = 5;
const BOT_AGENT = /bot|crawl|spider|curl|wget|python|httpclient|scrapy|headless|libwww|go-http|java\//i;

export function assessLogin(s: LoginSignals): { risk: Risk; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string, when: boolean) => {
    if (!when) return;
    score += points;
    reasons.push(reason);
  };
  add(3, "no or automated user agent", !s.userAgent || BOT_AGENT.test(s.userAgent));
  add(s.developer ? 2 : 1, "unknown device", !s.knownDevice);
  add(s.accountFailures >= 4 ? 2 : 1, "failures on this account", s.accountFailures >= 2);
  add(s.ipFailures >= 10 ? 4 : 2, "failures from this address", s.ipFailures >= 5);
  const risky = s.developer ? RISKY_FROM - 1 : RISKY_FROM;
  return { risk: score >= DANGEROUS_FROM ? "dangerous" : score >= risky ? "risky" : "no_risk", reasons };
}

// Device cookie: HMAC of the account, so it can't be forged or used for another account.
const DEVICE_COOKIE = "mf_dev";
const deviceToken = (account: string): string => createHmac("sha256", secretKey()).update(`device:${account}`).digest("base64url");

export async function isKnownDevice(account: string): Promise<boolean> {
  const sent = (await cookies()).get(DEVICE_COOKIE)?.value ?? "";
  const expected = deviceToken(account);
  return sent.length === expected.length && timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

export async function rememberDevice(account: string): Promise<void> {
  (await cookies()).set(DEVICE_COOKIE, deviceToken(account), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 3600,
  });
}

/** Captcha is Cloudflare Turnstile and only exists when both keys are set (Vercel env). */
export const captchaEnabled = (): boolean => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export async function captchaPassed(token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY ?? "", response: token, remoteip: ip }),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch (error) {
    console.error("captcha check failed", error);
    return false;
  }
}
