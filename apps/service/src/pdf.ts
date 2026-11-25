import { z } from "zod";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Util } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfTextPage {
  pageNumber: number;
  textItemCount: number;
  textCharacterCount: number;
  lowText: boolean;
  text: string;
  pageWidth: number;
  pageHeight: number;
  textBlocks: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export interface PdfInspection {
  pageCount: number;
  pages: PdfTextPage[];
  lowTextPageNumbers: number[];
}

export const pdfInspectionSchema = z.object({
  pageCount: z.number().int().positive(),
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    textItemCount: z.number().int().nonnegative(),
    textCharacterCount: z.number().int().nonnegative(),
    lowText: z.boolean(),
    text: z.string(),
    pageWidth: z.number().positive(),
    pageHeight: z.number().positive(),
    textBlocks: z.array(z.object({
      text: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    }).strict()),
  }).strict()),
  lowTextPageNumbers: z.array(z.number().int().positive()),
}).strict();

export async function inspectPdf(bytes: Buffer, maxPages: number): Promise<PdfInspection> {
  const header = bytes.subarray(0, Math.min(bytes.length, 1024)).toString("latin1");
  if (!header.includes("%PDF-")) throw new Error("INVALID_PDF_SIGNATURE");
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    stopAtErrors: true,
  });
  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages < 1 || pdf.numPages > maxPages) throw new Error("PDF_PAGE_LIMIT_EXCEEDED");
    const pages: PdfTextPage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const textBlocks = content.items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const transform = Util.transform(viewport.transform, item.transform);
        return [{
          text: item.str,
          x: transform[4],
          y: transform[5] - item.height,
          width: Math.max(0, item.width),
          height: Math.max(0, item.height),
        }];
      });
      const text = textBlocks.map((block) => block.text).join(" ");
      const textCharacterCount = text.trim().length;
      pages.push({
        pageNumber,
        textItemCount: textBlocks.length,
        textCharacterCount,
        lowText: textCharacterCount < 24,
        text,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        textBlocks,
      });
      page.cleanup();
    }
    return {
      pageCount: pdf.numPages,
      pages,
      lowTextPageNumbers: pages.filter((page) => page.lowText).map((page) => page.pageNumber),
    };
  } finally {
    await loadingTask.destroy();
  }
}
