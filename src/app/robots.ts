import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/appUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/razvoj", "/nalog", "/poruke", "/api", "/termin", "/q/"] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
