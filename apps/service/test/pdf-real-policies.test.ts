import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectPdf } from "../src/pdf.js";

const policyFiles = [
  "pvt-car-comprehensive-hdfc-ergo.pdf",
  "pvt-car-comprehensive-reliance.pdf",
  "pvt-car-satp-go-digit.pdf",
  "pvt-car-satp-tata-aig.pdf",
];

function syntheticPolicyPdf(): Buffer {
  const content = "BT /F1 12 Tf 72 720 Td (POLICY ISSUE DATE 2026-03-26) Tj ET";
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj\n`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(document));
    document += object;
  }
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  document += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "ascii");
}

describe("PDF.js on original policy documents", () => {
  it("extracts text and coordinates from a synthetic unseen policy PDF", async () => {
    const inspection = await inspectPdf(syntheticPolicyPdf(), 10);
    expect(inspection.pageCount).toBe(1);
    expect(inspection.pages[0]?.text).toContain("POLICY ISSUE DATE 2026-03-26");
    expect(inspection.pages[0]?.textBlocks.length).toBeGreaterThan(0);
    expect(inspection.pages[0]?.textBlocks[0]?.width).toBeGreaterThan(0);
  });

  for (const filename of policyFiles) {
    it(`validates PDF structure and page geometry for ${filename}`, async () => {
      const filePath = path.resolve(
        process.cwd(),
        "..",
        "..",
        "data",
        "source-corpus",
        "sample-policies",
        filename,
      );
      const bytes = await readFile(filePath);
      const inspection = await inspectPdf(bytes, 100);
      expect(inspection.pageCount).toBeGreaterThan(0);
      expect(inspection.pages).toHaveLength(inspection.pageCount);
      for (const page of inspection.pages) {
        expect(page.pageWidth).toBeGreaterThan(0);
        expect(page.pageHeight).toBeGreaterThan(0);
        expect(page.lowText).toBe(page.textCharacterCount < 24);
        for (const block of page.textBlocks) {
          expect(block.text.length).toBeGreaterThan(0);
          expect(Number.isFinite(block.x)).toBe(true);
          expect(Number.isFinite(block.y)).toBe(true);
        }
      }
    });
  }

  it("rejects input without an actual PDF signature", async () => {
    await expect(inspectPdf(Buffer.from("not a PDF"), 100)).rejects.toThrow("INVALID_PDF_SIGNATURE");
  });
});
