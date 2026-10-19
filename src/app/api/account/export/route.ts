import { apiError } from "@/lib/apiError";
import { exportAccountData } from "@/lib/accountDeletion";
import { accountExportPdf } from "@/lib/accountExportPdf";
import { getSessionUser } from "@/lib/auth";
import { pdfResponse } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/** Readable PDF copy of the signed-in person's data (right of access). */
export async function GET(): Promise<Response> {
  const session = await getSessionUser();
  if (!session) return apiError(401);
  const data = await exportAccountData(session.id);
  if (!data) return apiError(404, "Nalog nije pronađen.");
  return pdfResponse(await accountExportPdf(data), "moji-podaci-mojfrizer.pdf", { "Cache-Control": "private, no-store" });
}
