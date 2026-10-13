import { createHash } from "node:crypto";

/** Short fingerprint of the QR token for cache-busting image URLs. The token itself never appears in the page's image URL. */
export function qrVersion(qrToken: string): string {
  return createHash("sha256").update(qrToken).digest("hex").slice(0, 12);
}
