import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  inventoryDocumentForTataAig,
  normalizeTataAig,
} from "./adapter.js";
import type { TataAigAdapterDraft } from "./schema.js";

function toMarkdown(draft: TataAigAdapterDraft): string {
  const trace = draft.sampleResolutionTrace;
  const lines = [
    "# Tata AIG Private Car SATP Adapter Draft",
    "",
    "This source-cited adapter draft is not an approved commission rule or final payout.",
    "",
    "## Source identity",
    "",
    `- Workbook: ${draft.sourceIdentity.fileName}`,
    `- Path: \`${draft.sourceIdentity.relativePath}\``,
    `- SHA-256: \`${draft.sourceIdentity.sha256}\``,
    `- Byte size: ${draft.sourceIdentity.byteSize}`,
    `- Source-period label: ${draft.sourceIdentity.sourcePeriodLabel ?? "not present in IR"}`,
    `- Effective date status: ${draft.sourceIdentity.effectiveDateStatus}`,
    `- Manifest/source identity verification: ${draft.sourceIdentity.sourceIdentityVerification}`,
    "",
    "## Workbook inventory",
    "",
    `- Sheets: ${draft.validationSummary.sheetCount}`,
    `- Hidden sheets: ${draft.validationSummary.hiddenSheetCount}`,
    `- Pvtcar serialized matrix: ${draft.validationSummary.pvtcarMatrixRowCount} rows / ${draft.validationSummary.pvtcarCellCount} populated cells`,
    `- Formula cells preserved: ${draft.validationSummary.formulaCount}`,
    `- Formula cells with cached values preserved separately: ${draft.validationSummary.formulaCachedValueCount}`,
    `- Error cells preserved separately: ${draft.validationSummary.errorCellCount}`,
    `- Merged ranges in IR: ${draft.validationSummary.mergedRangeCount}`,
    `- Approved commission rules emitted: ${draft.validationSummary.approvedCommissionRuleCount}`,
    "",
    "### Sheets",
    "",
    "| Order | Sheet | Visibility | Scope | Dimension | Cells | Formulas | Cached | Errors | Merges |",
    "|---:|---|---|---|---|---:|---:|---:|---:|---:|",
  ];
  for (const sheet of draft.sheetInventory) {
    lines.push(
      `| ${sheet.order + 1} | ${sheet.name} | ${sheet.visibility} | ${sheet.scope} | ${sheet.dimension ?? "unknown"} | ${sheet.nonEmptyCellCount} | ${sheet.formulaCount} | ${sheet.formulaCachedValueCount} | ${sheet.errorCellCount} | ${sheet.mergedRanges.length} |`,
    );
  }

  lines.push(
    "",
    "## Pvtcar matrix coverage",
    "",
    `- Status: ${draft.matrixCoverage.status}`,
    `- Serialized IR dimension: ${draft.matrixCoverage.sourceDimension ?? "unknown"}`,
    `- Phase 0 documented dimension: ${draft.matrixCoverage.phase0DocumentedDimension}`,
    `- Boundary discrepancy: ${draft.matrixCoverage.boundaryDiscrepancy ? "yes" : "no"}`,
    `- Note: ${draft.matrixCoverage.note}`,
    "- All non-empty cells in the serialized IR are retained with exact sheet/cell citations.",
    "- Column header ancestry is derived from the serialized row-1-to-row-5 cells and any serialized merged ranges. No merged ranges were reported by this IR.",
    "",
    "## Sample base-grid trace",
    "",
    `- Policy class: ${trace.policyClass}`,
    `- Body type: ${trace.bodyType}; grid-Type mapping: ${trace.bodyTypeToGridTypeMapping}`,
    `- Known dimensions: Renewal / CNG / SATP / NCB All / Add On All / DELHI`,
    `- Candidate rows retained: ${trace.candidateTypes.map((candidate) => `${candidate.sourceRow} (${candidate.typeCategory})`).join(", ")}`,
    `- Candidate values: ${trace.candidateTypes.map((candidate) => `${candidate.rate.displayedPercent} at Pvtcar!V${candidate.sourceRow}`).join(", ")}`,
    `- Base candidate: ${trace.baseRateCandidate?.displayedPercent ?? "not established"} on ${trace.baseRateCandidate?.basis ?? "unknown"}`,
    `- Intermediary code: ${trace.sampleContext.intermediaryCode.value}; override record: not supplied`,
    `- Net premium: INR ${trace.sampleContext.netPremium.amountDecimal}; GST INR ${trace.sampleContext.gst.amountDecimal} is separate`,
    `- Anchor: issue date ${trace.sampleContext.policyIssueDateStatus}; insurer login date ${trace.sampleContext.insurerDefinedLoginDateStatus}; cover start ${trace.sampleContext.coverStartDate} is not substituted`,
    `- Same-insurer renewal: ${trace.sampleContext.sameInsurerRenewal ? "yes" : "no"}; coverage gap retained as context (previous expiry ${trace.sampleContext.coverageGapContext.previousPolicyExpiryDate})`,
    "- Final base commission: not approved",
    "- All-in payout: PENDING",
    "- OD applicability: NOT_APPLICABLE",
    "",
    "## Independent override hierarchies",
    "",
    "- Owner high-level hierarchy: Special Deal → Specific Sub-segment → Standard Grid.",
    "- Detailed workbook specificity: Policy-specific → Fleet-code → PAN-specific → Code-specific → Standard Grid.",
    "- Mapping between these hierarchies: not defined; they remain independent.",
    "- Override data status: not supplied.",
    "- General Guidelines!C17 appears inconsistent with the detailed C12:C16 order; it is preserved as a source inconsistency.",
    "",
    "## Date and payout stages",
    "",
  );
  for (const stage of trace.stages) {
    lines.push(`- **${stage.stage}: ${stage.status}.** ${stage.reason}`);
  }
  lines.push(
    "",
    "## Incremental COA",
    "",
    `- Status: ${draft.coaAssessment.status}`,
    `- Source mentions: ${draft.coaAssessment.sourceMentionsIncrement.map((reference) => `${reference.sheet}!${reference.cell}`).join(", ")}`,
    "- No GWP slab or increment was normalized because the Phase 2A IR/source evidence is insufficient.",
    "- The old pci checks pivot cache is excluded as current COA evidence; its cached zeros do not mean 0% or no increment.",
    `- Stale pivot context: source \`${draft.coaAssessment.stalePivotContext.cachedPivotSourceRange}\`, refresh ${draft.coaAssessment.stalePivotContext.cachedPivotRefreshDate}; cited Phase 0 extent ${draft.coaAssessment.stalePivotContext.phase0DocumentedPvtcarExtent}.`,
    `- Missing: ${draft.coaAssessment.missingInputs.join(", ")}`,
    "",
    "## Warnings",
    "",
  );
  for (const warning of draft.warnings) {
    lines.push(`- **${warning.code} (${warning.severity}):** ${warning.message}`);
  }
  lines.push(
    "",
    "## Provenance",
    "",
    "- Source-derived workbook values, project-owner clarifications, and sample policy facts are tagged separately in the JSON.",
    "- Formula expressions, cached values, and error codes are stored as distinct fields for all inventoried sheet cells containing formulas or errors.",
    "- Phase 2A IR was the sole workbook input. The adapter does not open XLSX files, import ExcelJS, or calculate formulas.",
    "",
  );
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

  const inventory = JSON.parse(await readFile(path.resolve(inputPath), "utf8")) as unknown;
  const document = inventoryDocumentForTataAig(inventory);
  const draft = normalizeTataAig(document);
  const outputDirectory = path.resolve(outputPath);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "tata-aig-satp-adapter-draft.json"),
    `${JSON.stringify(draft, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "TATA-AIG-ADAPTER-REPORT.md"),
    toMarkdown(draft),
    "utf8",
  );
  console.log(JSON.stringify({
    source: draft.sourceIdentity.relativePath,
    sourceIdentityVerification: draft.sourceIdentity.sourceIdentityVerification,
    sheetCount: draft.validationSummary.sheetCount,
    hiddenSheetCount: draft.validationSummary.hiddenSheetCount,
    pvtcarCellCount: draft.validationSummary.pvtcarCellCount,
    formulaCount: draft.validationSummary.formulaCount,
    formulaCachedValueCount: draft.validationSummary.formulaCachedValueCount,
    errorCellCount: draft.validationSummary.errorCellCount,
    candidateTypes: draft.sampleResolutionTrace.candidateTypes.map((candidate) => ({
      sourceRow: candidate.sourceRow,
      type: candidate.typeCategory,
      rate: candidate.rate.displayedPercent,
    })),
    allInPayoutStatus: draft.sampleResolutionTrace.allInPayoutStatus,
    approvedCommissionRuleCount: draft.validationSummary.approvedCommissionRuleCount,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
