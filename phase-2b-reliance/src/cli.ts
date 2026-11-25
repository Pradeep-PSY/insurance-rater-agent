import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  inventoryDocumentForReliance,
  normalizeReliancePrivateCar,
} from "./adapter.js";
import type { ReliancePrivateCarAdapterDraft } from "./schema.js";

function toMarkdown(draft: ReliancePrivateCarAdapterDraft): string {
  const trace = draft.sampleResolutionTrace;
  const rto = trace.rtoMappingCandidates[0];
  const model = trace.makeModelMappingCandidates[0];
  const lines = [
    "# Reliance IndusInd Private Car Adapter Draft",
    "",
    "This source-cited adapter draft is not an approved commission rule or rating result.",
    "",
    "## Source identity and applicability",
    "",
    `- Workbook: ${draft.sourceIdentity.fileName}`,
    `- Path: \`${draft.sourceIdentity.relativePath}\``,
    `- SHA-256: \`${draft.sourceIdentity.sha256}\``,
    `- Byte size: ${draft.sourceIdentity.byteSize}`,
    `- Workbook label: ${draft.sourceIdentity.workbookPeriodLabel.value} (filename label only)`,
    `- Private-car sheet title: ${draft.sourceIdentity.privateCarSheetTitle}`,
    `- Sheet period label: ${draft.sourceIdentity.privateCarSheetPeriodLabel.value} (title label only)`,
    "- Effective bounds: unknown; no dates inferred from labels",
    "",
    "## Workbook inventory",
    "",
    `- Sheets: ${draft.validationSummary.workbookSheetCount}`,
    `- RTO mappings: ${draft.validationSummary.rtoMappingCount}`,
    `- Make/model mappings: ${draft.validationSummary.makeModelMappingCount}`,
    `- Private-car matrix rows: ${draft.validationSummary.baseGridRowCount}`,
    `- H2:H6 terms: ${draft.validationSummary.termCount}`,
    `- Formula cells / formula errors: ${draft.validationSummary.workbookFormulaCount} / ${draft.validationSummary.workbookFormulaErrorCount}`,
    "- Approved commission rules emitted: 0",
    "",
  ];
  for (const sheet of draft.workbookInventory.sheets) {
    lines.push(
      `- ${sheet.name}: ${sheet.dimension ?? "unknown dimension"} (expected ${sheet.expectedSourceDimension ?? "not specified"}; matches: ${String(sheet.dimensionMatchesExpected)}), ${sheet.mergedRanges.length} merges, ${sheet.nonEmptyCellCount} cells, ${sheet.isEmpty ? "empty" : sheet.scope}`,
    );
  }
  lines.push(
    "",
    "## Sample decision trace",
    "",
    `- Status: ${trace.status}`,
    `- Reason: ${trace.reasonCode}`,
    `- Policy issue-date anchor: ${trace.dateAnchor.resolvedDate}`,
    `- Grid applicability: ${trace.gridApplicability}`,
    `- Latest-grid fallback used: ${trace.latestGridFallbackUsed}`,
    `- RTO mapping: ${rto?.normalizedRegistrationPrefix ?? "not found"} → ${rto ? `${rto.regionCity} / ${rto.marketType} / ${rto.zone}` : "unresolved"}`,
    `- Make/model mapping: ${model ? `${model.rawMake} / ${model.rawModel} → ${model.segment}` : "unresolved"} (segment not used as a rate dimension)`,
    `- Fuel: ${trace.policyFacts.fuel.status}; no approved vehicle-master evidence`,
    `- Previous insurer: ${trace.policyFacts.previousInsurer.status}; not inferred`,
    `- Conditional matrix candidate: ${trace.candidate.sourceRange ?? "none"}; rate values are not final`,
    `- <1000 CC relative adjustment factor: ${trace.candidate.relativeAdjustmentFactor} (condition satisfied; not applied to unsupported sample)`,
    "- Final commission rate: withheld",
    "- Final payout amount: withheld",
    "",
    "## Source-specific terms",
    "",
  );
  for (const term of draft.termsAndAdjustments) {
    lines.push(`- ${term.termType} — ${term.rawWording} (\`${term.source.sheet}!${term.source.cell}\`)`);
  }
  lines.push("", "## Warnings", "");
  for (const warning of draft.warnings) {
    lines.push(`- ${warning.code}: ${warning.message}`);
  }
  lines.push("", "## Mapping / rate counts", "");
  lines.push(`- RTO rows retained: ${draft.rtoMappings.length}`);
  lines.push(`- Make/model rows retained: ${draft.makeModelMappings.length}`);
  lines.push(`- Base-grid rows retained: ${draft.baseGridRows.length}`);
  lines.push(`- Master-grid raw cells retained: ${draft.workbookInventory.masterGridRawCells.length}`);
  lines.push(`- Contextual enabler rows retained without application: ${draft.workbookInventory.contextualObservations.length}`);
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
  const inventory: unknown = JSON.parse(await readFile(absoluteInput, "utf8"));
  const { document, verification } = inventoryDocumentForReliance(inventory);
  const draft = normalizeReliancePrivateCar(document, verification);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "reliance-private-car-adapter-draft.json"),
    `${JSON.stringify(draft, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "RELIANCE-ADAPTER-REPORT.md"),
    toMarkdown(draft),
    "utf8",
  );
  console.log(JSON.stringify({
    source: draft.sourceIdentity.relativePath,
    rtoMappingCount: draft.validationSummary.rtoMappingCount,
    makeModelMappingCount: draft.validationSummary.makeModelMappingCount,
    baseGridRowCount: draft.validationSummary.baseGridRowCount,
    termCount: draft.validationSummary.termCount,
    sampleStatus: draft.sampleResolutionTrace.status,
    gridApplicability: draft.sampleResolutionTrace.gridApplicability,
    approvedCommissionRuleCount: draft.validationSummary.approvedCommissionRuleCount,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
