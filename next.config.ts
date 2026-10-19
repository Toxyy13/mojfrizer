import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. Next.js renders small inline bootstrap scripts, so 'unsafe-inline' stays for scripts and
// styles; everything else is limited to this site. The only third party is the Google Maps embed (after consent).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://maps.google.com https://www.google.com https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

// Private areas and the API never belong in a search index.
const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
const privatePaths = ["admin", "razvoj", "nalog", "poruke", "api", "nova-lozinka", "potvrda-emaila", "termin", "q", "dodaj-salon"];

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  // PDF downloads read the embedded fonts from disk at runtime; make sure the serverless bundle ships them.
  outputFileTracingIncludes: { "/api/account/export": ["./src/assets/fonts/**"], "/admin/[slug]/qr/slika": ["./src/assets/fonts/**"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...privatePaths.map((path) => ({ source: `/${path}/:rest*`, headers: noIndex })),
    ];
  },
};

export default nextConfig;
