import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyManifest } from "./manifest.js";
import { readXlsxSource } from "./xlsx-reader.js";
import { readPdfGridSource } from "./pdf-reader.js";
import { createInventoryReport, toMarkdown } from "./inventory.js";
import type { GridDocumentIR } from "./grid-document-ir.js";
import type { ManifestVerificationRecord } from "./manifest.js";

export function isRaterDocument(
  record: ManifestVerificationRecord,
): record is ManifestVerificationRecord & {
  gridParseDisposition: "PARSE_XLSX" | "PARSE_PDF";
} {
  return record.status === "PASS" &&
    (record.gridParseDisposition === "PARSE_XLSX" ||
      record.gridParseDisposition === "PARSE_PDF");
}

function insurerForRelativePath(relativePath: string): GridDocumentIR["source"]["insurerId"] {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("/hdfc-ergo/")) return "HDFC_ERGO";
  if (normalized.includes("/godigit/")) return "GO_DIGIT";
  if (normalized.includes("/reliance-indusind/")) return "RELIANCE_INDUSIND";
  if (normalized.includes("/tata-aig/")) return "TATA_AIG";
  return "UNKNOWN";
}

async function main(): Promise<void> {
  const corpusArg = process.argv[2];
  const outputArg = process.argv[3];
  if (!corpusArg || !outputArg) {
    throw new Error("Usage: npm run inventory -- <source-root> <output-directory>");
  }

  const sourceRoot = path.resolve(corpusArg);
  const outputDirectory = path.resolve(outputArg);
  const manifestPath = path.join(sourceRoot, "MANIFEST.json");
  const verification = await verifyManifest(manifestPath, sourceRoot);
  const documents: GridDocumentIR[] = [];

  for (const record of verification.entries) {
    if (!isRaterDocument(record)) continue;
    const identity = {
      sourceId: record.sourceId,
      insurerId: insurerForRelativePath(record.relativePath),
      fileName: path.basename(record.relativePath),
      relativePath: record.relativePath,
      sha256: record.actualSha256 ?? "",
      byteSize: record.actualByteSize ?? 0,
    };
    if (record.gridParseDisposition === "PARSE_XLSX") {
      documents.push(await readXlsxSource(identity, record.absolutePath));
    } else if (record.gridParseDisposition === "PARSE_PDF") {
      documents.push(await readPdfGridSource(identity, record.absolutePath));
    }
  }

  await mkdir(outputDirectory, { recursive: true });
  const report = createInventoryReport(
    verification.entries,
    documents,
    verification.manifestFound,
    verification.manifestError,
    verification.formatVersion,
    verification.contents,
  );
  await writeFile(
    path.join(outputDirectory, "phase-2a-inventory.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "phase-2a-inventory.md"),
    toMarkdown(report),
    "utf8",
  );
  console.log(JSON.stringify(report.compactSummary));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
