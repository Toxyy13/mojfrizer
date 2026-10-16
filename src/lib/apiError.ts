import { NextResponse } from "next/server";

// One error shape for every JSON endpoint: { error: "<Serbian text for people>", code: "<stable machine key>" }.
// Never put exception messages, SQL or stack traces in `error`; log them on the server instead.

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "server_error";

const DEFAULTS: Record<number, { code: ApiErrorCode; error: string }> = {
  400: { code: "bad_request", error: "Neispravan zahtev." },
  401: { code: "unauthorized", error: "Prijavite se." },
  403: { code: "forbidden", error: "Nemate pristup." },
  404: { code: "not_found", error: "Nije pronađeno." },
  413: { code: "payload_too_large", error: "Zahtev je prevelik." },
  415: { code: "unsupported_media_type", error: "Format nije podržan." },
  429: { code: "rate_limited", error: "Previše zahteva. Pokušajte malo kasnije." },
  500: { code: "server_error", error: "Došlo je do greške. Pokušajte ponovo." },
};

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
}

/** JSON error answer with the matching HTTP status. `message` overrides the default text for that status. */
export function apiError(status: number, message?: string, headers?: HeadersInit): NextResponse<ApiErrorBody> {
  const base = DEFAULTS[status] ?? DEFAULTS[500];
  return NextResponse.json({ error: message ?? base.error, code: base.code }, { status, headers });
}

/** Reads a JSON request body; null when it is missing or not valid JSON (answer with 400, not 500). */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
