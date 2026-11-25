import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  inventoryDocumentForGoDigit,
  normalizeGoDigitSatp,
} from "./adapter.js";
import type { GoDigitSatpAdapterDraft } from "./schema.js";

function toMarkdown(draft: GoDigitSatpAdapterDraft): string {
  const trace = draft.sampleResolutionTrace;
  const lines = [
    "# Go Digit Private Car SATP Adapter Draft",
    "",
    "This is a source-cited adapter draft, not an approved commission rule or rating result.",
    "",
    "## Source",
    "",
    `- Workbook: ${draft.sourceIdentity.fileName}`,
    `- Path: \`${draft.sourceIdentity.relativePath}\``,
    `- SHA-256: \`${draft.sourceIdentity.sha256}\``,
    `- Byte size: ${draft.sourceIdentity.byteSize}`,
    `- Source-period label: ${draft.sourceIdentity.sourcePeriodLabel ?? "unknown"} (path label only)`,
    `- Effective-date status: ${draft.sourceIdentity.effectiveDateStatus}`,
    "",
    "## Inventory",
    "",
    `- 4WTP RTO mapping rows: ${draft.validationSummary.rtoMappingCount}`,
    `- SATP rows: ${draft.validationSummary.satpRowCount}`,
    `- All_India_Decline RTO mappings: ${draft.validationSummary.declineMappingCount}`,
    `- All_India_Decline SATP rows: ${draft.validationSummary.declineSatpRowCount}`,
    `- Unresolved note exceptions: ${draft.validationSummary.exceptionCandidateCount}`,
    `- Conflicting normalized RTO codes: ${draft.validationSummary.conflictingRtoCodeCount}`,
    `- SATP composite-key formulas preserved: ${draft.validationSummary.satpCompositeKeyFormulaCount}`,
    "- Approved commission rules emitted: 0",
    "",
    "## Sample lookup trace",
    "",
    `- Status: ${trace.status}`,
  ];

  if (trace.status === "AMBIGUOUS") {
    lines.push(
      `- Reason: ${trace.reasonCode}`,
      `- RTO: ${trace.rtoMapping.normalizedRtoCode} → ${trace.rtoMapping.cluster ?? "conflicting clusters"}`,
      `- RTO evidence: ${trace.rtoMapping.sourceRanges.map((range) => `\`${range}\``).join(", ")}`,
      `- Segment label: \`${trace.segmentSelection.exactGridLabel}\``,
      `- Age condition: \`${trace.ageSelection.condition}\` (required: ${trace.ageSelection.ageRequired})`,
      `- Candidate row(s): ${trace.candidateRows.map((row) => `${row.sourceRange} (row ${row.sourceRow})`).join(", ") || "none"}`,
      `- Raw metric: ${trace.rawMetric?.rawNumericValue ?? "not available"} (${trace.rawMetric?.fieldName ?? "none"}; semantic status ${trace.rawMetric?.semanticStatus ?? "not evaluated"})`,
      "- TP commission rate: withheld",
      "- OD applicability: NOT_APPLICABLE",
    );
  } else if (trace.status === "DECLINED") {
    lines.push(
      `- Reason: ${trace.reasonCode}`,
      `- RTO: ${trace.rtoMapping.normalizedRtoCode} → All_India_Decline`,
      `- TP commission rate: withheld`,
      "- OD applicability: NOT_APPLICABLE",
    );
  } else if (trace.status === "UNRESOLVED") {
    lines.push(
      `- Reason: ${trace.reasonCode}`,
      "- TP commission rate: withheld",
      "- OD applicability: NOT_APPLICABLE",
    );
  } else {
    lines.push(`- Reason: ${trace.reason}`);
  }

  lines.push("", "## Warnings", "");
  for (const warning of draft.warnings) {
    lines.push(`- ${warning.code}: ${warning.message}`);
  }
  lines.push("", "## Unresolved note exceptions", "");
  for (const exception of draft.exceptionCandidates) {
    lines.push(`- \`4W SATP!${exception.source.cell}\` (row ${exception.sourceRow}): ${exception.note}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    throw new Error(
      "Usage: npm run normalize -- <phase-2a-inventory.json> <output-directory>",
    );
  }
  const absoluteInput = path.resolve(inputPath);
  const outputDirectory = path.resolve(outputPath);
  const inventoryValue: unknown = JSON.parse(await readFile(absoluteInput, "utf8"));
  const sourceDocument = inventoryDocumentForGoDigit(inventoryValue);
  const draft = normalizeGoDigitSatp(sourceDocument);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "go-digit-satp-adapter-draft.json"),
    `${JSON.stringify(draft, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "GO-DIGIT-ADAPTER-REPORT.md"),
    toMarkdown(draft),
    "utf8",
  );
  console.log(JSON.stringify({
    source: draft.sourceIdentity.relativePath,
    rtoMappingCount: draft.validationSummary.rtoMappingCount,
    declineMappingCount: draft.validationSummary.declineMappingCount,
    satpRowCount: draft.validationSummary.satpRowCount,
    exceptionCandidateCount: draft.validationSummary.exceptionCandidateCount,
    sampleStatus: draft.sampleResolutionTrace.status,
    approvedCommissionRuleCount: draft.validationSummary.approvedCommissionRuleCount,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
