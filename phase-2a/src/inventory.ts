import { readFile } from "node:fs/promises";
import type { GridDocumentIR } from "./grid-document-ir.js";
import type { ManifestVerificationRecord } from "./manifest.js";

export interface InventoryReport {
  schemaVersion: "2A.0.0";
  generatedAt: string;
  formatVersion: number | null;
  contents: Record<string, unknown> | null;
  manifestFound: boolean;
  manifestError: string | null;
  manifestVerifications: ManifestVerificationRecord[];
  documents: GridDocumentIR[];
  compactSummary: {
    manifestPassCount: number;
    manifestFailCount: number;
    workbookCount: number;
    pdfCount: number;
    workbookSheetCount: number;
    pdfPageCount: number;
  };
  noCommissionRulesEmitted: true;
}

export function createInventoryReport(
  manifestVerifications: ManifestVerificationRecord[],
  documents: GridDocumentIR[],
  manifestFound: boolean,
  manifestError: string | null,
  formatVersion: number | null = null,
  contents: Record<string, unknown> | null = null,
): InventoryReport {
  const workbooks = documents.filter((document) => document.workbook);
  const pdfs = documents.filter((document) => document.pdf);
  return {
    schemaVersion: "2A.0.0",
    generatedAt: new Date().toISOString(),
    formatVersion,
    contents,
    manifestFound,
    manifestError,
    manifestVerifications,
    documents,
    compactSummary: {
      manifestPassCount: manifestVerifications.filter((record) => record.status === "PASS").length,
      manifestFailCount: manifestVerifications.filter((record) => record.status === "FAIL").length,
      workbookCount: workbooks.length,
      pdfCount: pdfs.length,
      workbookSheetCount: workbooks.reduce(
        (total, document) => total + (document.workbook?.sheets.length ?? 0),
        0,
      ),
      pdfPageCount: pdfs.reduce(
        (total, document) => total + (document.pdf?.pages.length ?? 0),
        0,
      ),
    },
    noCommissionRulesEmitted: true,
  };
}

export function toMarkdown(report: InventoryReport): string {
  const lines = [
    "# Phase 2A Source Inventory",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Status",
    "",
    `- Manifest found: ${report.manifestFound}`,
    `- Manifest error: ${report.manifestError ?? "None"}`,
    `- Manifest pass: ${report.compactSummary.manifestPassCount}`,
    `- Manifest fail: ${report.compactSummary.manifestFailCount}`,
    `- Workbooks: ${report.compactSummary.workbookCount}`,
    `- Workbook sheets: ${report.compactSummary.workbookSheetCount}`,
    `- PDFs: ${report.compactSummary.pdfCount}`,
    `- PDF pages: ${report.compactSummary.pdfPageCount}`,
    "- Commission rules emitted: No",
    "",
    "## Manifest verification",
    "",
  ];

  for (const record of report.manifestVerifications) {
    lines.push(
      `- ${record.status} — ${record.relativePath} — parser: ${record.gridParseDisposition} — SHA ${record.hashMatches ? "match" : "mismatch/missing"} — bytes ${record.byteSizeMatches ? "match" : "mismatch/missing"}${record.error ? ` — ${record.error}` : ""}`,
    );
  }

  lines.push("", "## Document inventory", "");
  for (const document of report.documents) {
    lines.push(`### ${document.source.fileName}`);
    lines.push("");
    lines.push(`- Format: ${document.source.format}`);
    lines.push(`- SHA-256: ${document.source.sha256}`);
    lines.push(`- Bytes: ${document.source.byteSize}`);
    lines.push(`- Effective date status: ${document.source.effectiveDateStatus}`);
    if (document.workbook) {
      for (const sheet of document.workbook.sheets) {
        lines.push(
          `- Sheet ${sheet.order + 1}: ${sheet.name} — ${sheet.visibility} — ${sheet.dimension ?? "no dimension"} — ${sheet.actualRowCount} rows — ${sheet.actualColumnCount} columns — ${sheet.mergedRanges.length} merged ranges — ${sheet.cells.length} non-empty cells`,
        );
      }
    }
    if (document.pdf) {
      for (const page of document.pdf.pages) {
        lines.push(`- PDF page ${page.pageNumber}: ${page.width}x${page.height} — ${page.textItems.length} text items`);
      }
    }
    for (const warning of document.warnings) {
      lines.push(`- ${warning.severity} ${warning.code}: ${warning.message}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
