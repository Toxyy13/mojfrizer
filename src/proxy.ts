import { NextResponse, type NextRequest } from "next/server";

// Each salon can also live on its own subdomain: kod-olgice.mojfrizer.com -> /s/kod-olgice
const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin"]);
const PASSTHROUGH_PREFIXES = ["/admin", "/razvoj", "/dodaj-salon", "/api", "/prijava", "/registracija", "/nalog", "/poruke", "/zaboravljena-lozinka", "/nova-lozinka", "/potvrda-emaila", "/termin", "/s/", "/q/", "/uslovi", "/privatnost", "/kolacici", "/povracaj-novca", "/brisanje-podataka", "/o-nama", "/licence", "/odjava-mejlova"];

export function proxy(request: NextRequest): NextResponse {
  const rootDomain = process.env.ROOT_DOMAIN;
  const host = (request.headers.get("host") ?? "").split(":")[0];
  if (!rootDomain || !host.endsWith(`.${rootDomain}`)) return NextResponse.next();

  const subdomain = host.slice(0, -(rootDomain.length + 1));
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return NextResponse.next();

  const url = request.nextUrl.clone();
  if (PASSTHROUGH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return NextResponse.next();
  url.pathname = `/s/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
