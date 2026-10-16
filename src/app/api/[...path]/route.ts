import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// Any /api address that has no handler of its own answers with JSON (not the HTML 404 page).
const notFound = (): ReturnType<typeof apiError> => apiError(404, "Adresa ne postoji.");

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
