import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { verifyManifest, actualManifestSchema, getGridParseDisposition } from "../src/manifest.js";
import { readXlsxSource } from "../src/xlsx-reader.js";
import { readPdfGridSource } from "../src/pdf-reader.js";
import { createInventoryReport, toMarkdown } from "../src/inventory.js";

async function shaBytes(bytes: Uint8Array): Promise<string> {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("Phase 2A raw source reader", () => {
  it("accepts the actual manifest structure and maps bytes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-actual-"));
    try {
      await mkdir(path.join(directory, "raters", "godigit"), { recursive: true });
      const bytes = Buffer.from("synthetic-grid");
      await writeFile(path.join(directory, "raters", "godigit", "grid.xlsx"), bytes);
      const manifest = {
        formatVersion: 1,
        contents: { spreadsheetRateCards: 1 },
        files: [{
          path: "raters/godigit/grid.xlsx",
          bytes: bytes.length,
          sha256: await shaBytes(bytes),
        }],
      };
      await writeFile(path.join(directory, "MANIFEST.json"), JSON.stringify(manifest));

      expect(actualManifestSchema.parse(manifest).contents).toEqual({ spreadsheetRateCards: 1 });
      const result = await verifyManifest(path.join(directory, "MANIFEST.json"), directory);
      expect(result.formatVersion).toBe(1);
      expect(result.contents).toEqual({ spreadsheetRateCards: 1 });
      expect(result.entries[0]).toMatchObject({
        relativePath: "raters/godigit/grid.xlsx",
        listedByteSize: bytes.length,
        actualByteSize: bytes.length,
        byteSizeMatches: true,
        status: "PASS",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects invalid SHA-256 and invalid positive byte counts", () => {
    expect(actualManifestSchema.safeParse({
      formatVersion: 1,
      contents: {},
      files: [{ path: "raters/grid.xlsx", bytes: 1, sha256: "not-a-sha" }],
    }).success).toBe(false);
    expect(actualManifestSchema.safeParse({
      formatVersion: 1,
      contents: {},
      files: [{ path: "raters/grid.xlsx", bytes: 0, sha256: "a".repeat(64) }],
    }).success).toBe(false);
  });

  it("rejects invalid paths and path traversal attempts", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-path-"));
    try {
      for (const manifestPath of [
        "../outside.xlsx",
        "raters/../../outside.xlsx",
        "/absolute/outside.xlsx",
      ]) {
        await writeFile(path.join(directory, "MANIFEST.json"), JSON.stringify({
          formatVersion: 1,
          contents: {},
          files: [{ path: manifestPath, bytes: 1, sha256: "a".repeat(64) }],
        }));
        const result = await verifyManifest(path.join(directory, "MANIFEST.json"), directory);
        expect(result.entries).toHaveLength(0);
        expect(result.manifestError).toContain("Manifest");
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("records missing files, size mismatches and checksum mismatches", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-integrity-"));
    try {
      await writeFile(path.join(directory, "present.bin"), "abc");
      await writeFile(path.join(directory, "MANIFEST.json"), JSON.stringify({
        formatVersion: 1,
        contents: {},
        files: [
          { path: "missing.bin", bytes: 3, sha256: "a".repeat(64) },
          { path: "present.bin", bytes: 99, sha256: "b".repeat(64) },
        ],
      }));
      const result = await verifyManifest(path.join(directory, "MANIFEST.json"), directory);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]?.exists).toBe(false);
      expect(result.entries[0]?.status).toBe("FAIL");
      expect(result.entries[1]?.exists).toBe(true);
      expect(result.entries[1]?.byteSizeMatches).toBe(false);
      expect(result.entries[1]?.hashMatches).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("selects only rater XLSX, XLSM and PDF documents for parsing", () => {
    expect(getGridParseDisposition("raters/godigit/grid.xlsx", "PASS")).toBe("PARSE_XLSX");
    expect(getGridParseDisposition("raters/reliance/grid.xlsm", "PASS")).toBe("PARSE_XLSX");
    expect(getGridParseDisposition("raters/hdfc/grid.pdf", "PASS")).toBe("PARSE_PDF");
  });

  it("excludes sample policies and integrity-failed files from parsing", () => {
    expect(getGridParseDisposition("sample-policies/policy.pdf", "PASS"))
      .toBe("VERIFY_ONLY_SAMPLE_POLICY");
    expect(getGridParseDisposition("sample-policies/policy.pdf", "FAIL"))
      .toBe("NOT_PARSED_INTEGRITY_FAILED");
    expect(getGridParseDisposition("raters/hdfc/grid.pdf", "FAIL"))
      .toBe("NOT_PARSED_INTEGRITY_FAILED");
  });

  it("reports unsupported and unknown manifest paths explicitly", () => {
    expect(getGridParseDisposition("raters/tata-aig/unknown.bin", "PASS"))
      .toBe("UNSUPPORTED_EXTENSION");
    expect(getGridParseDisposition("other/grid.pdf", "PASS"))
      .toBe("UNKNOWN_PATH");
  });

  it("verifies sample policies while excluding them from PDF parsing", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-sample-"));
    try {
      await mkdir(path.join(directory, "sample-policies"), { recursive: true });
      const bytes = Buffer.from("synthetic-policy-pdf");
      await writeFile(path.join(directory, "sample-policies", "policy.pdf"), bytes);
      await writeFile(path.join(directory, "MANIFEST.json"), JSON.stringify({
        formatVersion: 1,
        contents: { policyPdfs: 1 },
        files: [{
          path: "sample-policies/policy.pdf",
          bytes: bytes.length,
          sha256: await shaBytes(bytes),
        }],
      }));
      const result = await verifyManifest(path.join(directory, "MANIFEST.json"), directory);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({
        status: "PASS",
        gridParseDisposition: "VERIFY_ONLY_SAMPLE_POLICY",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("verifies manifest hash and byte length matches", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-match-"));
    try {
      const filePath = path.join(directory, "source.xlsx");
      await writeFile(filePath, "synthetic-source");
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(filePath));
      const manifest = {
        sources: [{
          sourceId: "source-1",
          insurerId: "GO_DIGIT",
          relativePath: "source.xlsx",
          sha256: await shaBytes(bytes),
          byteSize: bytes.length,
        }],
      };
      const manifestPath = path.join(directory, "MANIFEST.json");
      await writeFile(manifestPath, JSON.stringify(manifest));
      const result = await verifyManifest(manifestPath, directory);
      expect(result.entries[0]?.status).toBe("PASS");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns a mismatch record instead of skipping it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-mismatch-"));
    try {
      const filePath = path.join(directory, "source.pdf");
      await writeFile(filePath, "not-a-real-pdf");
      await writeFile(path.join(directory, "MANIFEST.json"), JSON.stringify({
        sources: [{
          sourceId: "source-1",
          relativePath: "source.pdf",
          sha256: "0".repeat(64),
          byteSize: 999,
        }],
      }));
      const result = await verifyManifest(path.join(directory, "MANIFEST.json"), directory);
      expect(result.entries[0]?.status).toBe("FAIL");
      expect(result.entries[0]?.hashMatches).toBe(false);
      expect(result.entries[0]?.byteSizeMatches).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("inventories hidden and empty sheets and merged ranges", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-xlsx-"));
    try {
      const workbook = new ExcelJS.Workbook();
      const visible = workbook.addWorksheet("Visible");
      visible.mergeCells("A1:C1");
      visible.getCell("A1").value = "Header";
      visible.getCell("D1").value = "Tail";
      const hidden = workbook.addWorksheet("Hidden");
      hidden.state = "hidden";
      workbook.addWorksheet("Empty");
      const filePath = path.join(directory, "source.xlsx");
      await workbook.xlsx.writeFile(filePath);
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(filePath));

      const document = await readXlsxSource({
        sourceId: "xlsx-1",
        insurerId: "TATA_AIG",
        fileName: "source.xlsx",
        relativePath: "source.xlsx",
        sha256: await shaBytes(bytes),
        byteSize: bytes.length,
      }, filePath);

      expect(document.workbook?.sheets).toHaveLength(3);
      expect(document.workbook?.sheets[1]?.visibility).toBe("HIDDEN");
      expect(document.workbook?.sheets[2]?.name).toBe("Empty");
      expect(document.workbook?.sheets[0]?.mergedRanges).toContain("A1:C1");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves formula and cached result separately and formula errors", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-formula-"));
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Check");
      sheet.getCell("A1").value = { formula: "1+1", result: 2 };
      sheet.getCell("A2").value = { formula: "NA()", result: { error: "#N/A" } };
      sheet.getCell("A1").numFmt = "0.0%";
      const filePath = path.join(directory, "source.xlsx");
      await workbook.xlsx.writeFile(filePath);
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(filePath));

      const document = await readXlsxSource({
        sourceId: "xlsx-2",
        insurerId: "GO_DIGIT",
        fileName: "source.xlsx",
        relativePath: "source.xlsx",
        sha256: await shaBytes(bytes),
        byteSize: bytes.length,
      }, filePath);

      const cells = document.workbook?.sheets[0]?.cells ?? [];
      expect(cells.find((cell) => cell.address === "A1")).toMatchObject({
        formula: "1+1",
        cachedValue: 2,
        numberFormat: "0.0%",
      });
      expect(cells.find((cell) => cell.address === "A2")?.errorCode).toBe("#N/A");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("isolates workbook parser failures instead of omitting the source", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-failure-"));
    try {
      const filePath = path.join(directory, "broken.xlsx");
      await writeFile(filePath, "not an xlsx");
      const document = await readXlsxSource({
        sourceId: "xlsx-broken",
        insurerId: "RELIANCE_INDUSIND",
        fileName: "broken.xlsx",
        relativePath: "broken.xlsx",
        sha256: "0".repeat(64),
        byteSize: 12,
      }, filePath);
      expect(document.workbook?.sheets).toEqual([]);
      expect(document.warnings.some((warning) => warning.code === "XLSX_PRIMARY_PARSER_FAILED")).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves PDF pages and text coordinates", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "phase2a-pdf-"));
    try {
      const pdf = await PDFDocument.create();
      const page = pdf.addPage([300, 200]);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      page.drawText("HDFC raw grid text", {
        x: 25,
        y: 150,
        size: 12,
        font,
      });
      const bytes = await pdf.save();
      const filePath = path.join(directory, "hdfc.pdf");
      await writeFile(filePath, bytes);
      const document = await readPdfGridSource({
        sourceId: "pdf-1",
        insurerId: "HDFC_ERGO",
        fileName: "hdfc.pdf",
        relativePath: "hdfc.pdf",
        sha256: await shaBytes(bytes),
        byteSize: bytes.length,
      }, filePath);

      expect(document.pdf?.pages).toHaveLength(1);
      expect(document.pdf?.pages[0]?.width).toBeGreaterThan(0);
      expect(document.pdf?.pages[0]?.textItems.length).toBeGreaterThan(0);
      expect(document.pdf?.pages[0]?.textItems[0]).toMatchObject({
        text: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("creates compact and Markdown inventory without commission rules", async () => {
    const report = createInventoryReport([], [], false, "MANIFEST.json not found");
    expect(report.noCommissionRulesEmitted).toBe(true);
    expect(toMarkdown(report)).toContain("Commission rules emitted: No");
  });
});
