import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

// Every download from the site is a PDF. Liberation Sans is embedded because the built-in PDF fonts lack č, ć and đ.
const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");

export type PdfSection = { heading: string; lines: string[] };

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.12, 0.11, 0.1);
const MUTED = rgb(0.42, 0.4, 0.38);

async function newDoc(title: string): Promise<{ doc: PDFDocument; regular: PDFFont; bold: PDFFont }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setCreator("mojfrizer.com");
  const [regular, bold] = await Promise.all(
    ["LiberationSans-Regular.ttf", "LiberationSans-Bold.ttf"].map(async (file) => doc.embedFont(await readFile(path.join(FONT_DIR, file)), { subset: true })),
  );
  return { doc, regular, bold };
}

/** Breaks text into lines that fit the width; words longer than a line are cut. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, size) > width) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

/** A plain text report: title, optional subtitle and headed sections of lines, paged automatically. */
export async function textPdf(title: string, subtitle: string, sections: PdfSection[]): Promise<Uint8Array> {
  const { doc, regular, bold } = await newDoc(title);
  const width = A4[0] - 2 * MARGIN;
  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;

  const write = (text: string, font: PDFFont, size: number, color = INK, gap = 4): void => {
    for (const line of wrap(text, font, size, width)) {
      if (y - size < MARGIN) {
        page = doc.addPage(A4);
        y = A4[1] - MARGIN;
      }
      y -= size;
      page.drawText(line, { x: MARGIN, y, size, font, color });
      y -= gap;
    }
  };

  write(title, bold, 20, INK, 8);
  if (subtitle) write(subtitle, regular, 10, MUTED, 14);
  for (const section of sections) {
    y -= 10;
    write(section.heading, bold, 13, INK, 6);
    if (section.lines.length === 0) write("Nema podataka.", regular, 10, MUTED);
    for (const line of section.lines) write(line, regular, 10);
  }
  return doc.save();
}

/** A4 poster: salon name, the QR code image (PNG bytes) and the address. */
export async function qrPosterPdf(opts: { salonName: string; qrPng: Uint8Array; host: string; address: string }): Promise<Uint8Array> {
  const { doc, regular, bold } = await newDoc(`QR kod: ${opts.salonName}`);
  const page = doc.addPage(A4);
  const centered = (text: string, y: number, size: number, font: PDFFont, color = INK): void => {
    page.drawText(text, { x: (A4[0] - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
  };
  const fit = (text: string, font: PDFFont, size: number): string => {
    let t = text;
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > A4[0] - 2 * MARGIN) t = t.slice(0, -1);
    return t;
  };
  const qr = await doc.embedPng(opts.qrPng);
  const side = 360;
  centered("ZAKAŽITE ONLINE, 0–24H", 720, 14, regular, MUTED);
  centered(fit(opts.salonName, bold, 40), 660, 40, bold);
  page.drawImage(qr, { x: (A4[0] - side) / 2, y: 250, width: side, height: side });
  centered("Skenirajte kamerom telefona", 205, 16, regular);
  centered(opts.host, 180, 12, regular, MUTED);
  centered(fit(opts.address, regular, 11), 130, 11, regular, MUTED);
  return doc.save();
}

export function pdfResponse(bytes: Uint8Array, filename: string, headers: Record<string, string> = {}): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
