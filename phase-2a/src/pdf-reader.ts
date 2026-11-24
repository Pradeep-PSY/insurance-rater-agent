import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { GridDocumentIR } from "./grid-document-ir.js";
import type { parserWarningSchema } from "./grid-document-ir.js";
import { gridDocumentIRSchema } from "./grid-document-ir.js";
import type { z } from "zod";
import type { TextItem } from "pdfjs-dist/types/src/display/api.js";

type ParserWarning = z.infer<typeof parserWarningSchema>;

export async function readPdfGridSource(
  source: Pick<GridDocumentIR["source"], "sourceId" | "insurerId" | "fileName" | "relativePath" | "sha256" | "byteSize">,
  absolutePath: string,
  parserWarnings: ParserWarning[] = [],
): Promise<GridDocumentIR> {
  const warnings: ParserWarning[] = [...parserWarnings];

  try {
    const bytes = await readFile(absolutePath);
    const task = getDocument({
      data: new Uint8Array(bytes),
      useWorkerFetch: false,
      standardFontDataUrl: new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).toString(),
    });
    const document = await task.promise;
    const pages: Array<{
      pageNumber: number;
      width: number;
      height: number;
      textItems: Array<{ text: string; x: number; y: number; width: number; height: number }>;
    }> = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textItems = content.items
        .filter((item): item is TextItem => "str" in item)
        .map((item) => ({
          text: item.str,
          x: item.transform[4] ?? 0,
          y: item.transform[5] ?? 0,
          width: item.width,
          height: item.height,
        }));
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        textItems,
      });
    }

    await task.destroy();
    if (pages.length === 0) {
      warnings.push({
        code: "PDF_NO_PAGES",
        severity: "BLOCKER",
        message: "PDF contains no pages.",
      });
    }

    return gridDocumentIRSchema.parse({
      schemaVersion: "2A.0.0",
      source: {
        ...source,
        format: "PDF",
        sourcePeriodLabel: undefined,
        effectiveFrom: null,
        effectiveTo: null,
        effectiveDateStatus: "UNKNOWN",
      },
      pdf: { pages },
      warnings,
    });
  } catch (error) {
    warnings.push({
      code: "PDF_PRIMARY_PARSER_FAILED",
      severity: "BLOCKER",
      message: `pdfjs-dist failed to read the PDF: ${error instanceof Error ? error.message : String(error)}`,
    });
    return gridDocumentIRSchema.parse({
      schemaVersion: "2A.0.0",
      source: {
        ...source,
        format: "PDF",
        sourcePeriodLabel: undefined,
        effectiveFrom: null,
        effectiveTo: null,
        effectiveDateStatus: "UNKNOWN",
      },
      pdf: { pages: [] },
      warnings,
    });
  }
}
