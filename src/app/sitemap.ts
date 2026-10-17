import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/appUrl";
import { db } from "@/lib/db";
import { LEGAL_LINKS } from "@/lib/company";
import { PUBLIC_SALONS } from "@/lib/salonVisibility";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const salons = await db.salon.findMany({ where: { isActive: true, ...PUBLIC_SALONS, services: { some: { isActive: true } } }, select: { slug: true } });
  return [
    { url: base },
    ...LEGAL_LINKS.map((link) => ({ url: `${base}${link.href}` })),
    ...salons.map((salon) => ({ url: `${base}/s/${salon.slug}` })),
  ];
}
