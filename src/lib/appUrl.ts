/**
 * Public address of the site, used in emails, QR codes and OAuth redirects.
 * APP_URL wins; on Vercel without it, the project's production URL (*.vercel.app or its domain).
 */
export function appUrl(fallback = "https://mojfrizer.com"): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return fallback;
}
