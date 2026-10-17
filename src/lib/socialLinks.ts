// Social profiles a salon can show on its public page, stored as canonical https URLs.
export const SOCIAL_NETWORKS = ["instagram", "facebook", "tiktok"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LABELS: Record<SocialNetwork, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

const HOSTS: Record<SocialNetwork, string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  tiktok: ["tiktok.com"],
};
const BASE: Record<SocialNetwork, string> = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
  tiktok: "https://www.tiktok.com/@",
};
const HANDLE = /^[A-Za-z0-9._-]{1,60}$/;

// Accepts "@name", "name" or a link on the network's own domain. "" for empty input, null when invalid.
export function normalizeSocial(network: SocialNetwork, raw: string): string | null {
  const input = raw.trim();
  if (!input) return "";
  let handle = input.replace(/^@/, "");
  if (!HANDLE.test(handle)) {
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
      return null;
    }
    const host = url.hostname.replace(/^(www|m)\./, "");
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || !HOSTS[network].includes(host)) return null;
    handle = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") ?? "";
    if (!HANDLE.test(handle)) return null;
  }
  return BASE[network] + handle;
}

// Defence in depth when rendering: only ever link to a valid URL for the network.
export function safeSocialUrl(network: SocialNetwork, stored: string | null | undefined): string | null {
  return stored ? normalizeSocial(network, stored) || null : null;
}
