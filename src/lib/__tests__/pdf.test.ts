import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { qrPosterPdf, textPdf } from "../pdf";

const isPdf = (b: Uint8Array): boolean => Buffer.from(b.slice(0, 5)).toString() === "%PDF-";

describe("pdf", () => {
  it("makes a multi-page PDF with Serbian letters and long text", async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `č ć š ž đ Č Ć Š Ž Đ ${i} ${"reč ".repeat(40)}`);
    const bytes = await textPdf("Moji podaci", "mojfrizer.com", [{ heading: "Poruke", lines }, { heading: "Prazno", lines: [] }]);
    expect(isPdf(bytes)).toBe(true);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it("makes a QR poster", async () => {
    const qrPng = await QRCode.toBuffer("https://mojfrizer.com/q/x", { type: "png", width: 300 });
    expect(isPdf(await qrPosterPdf({ salonName: "Kod Olgice", qrPng, host: "mojfrizer.com", address: "Nikole Pašića 27, 18000 Niš" }))).toBe(true);
  });
});
