import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeHdfcErgoInventory } from "./adapter.js";
import type { HdfcErgoAdapterDraft } from "./schema.js";

function toMarkdown(draft: HdfcErgoAdapterDraft): string {
  const trace = draft.sampleResolutionTrace;
  const lines = [
    "# HDFC ERGO Private Car Grid Adapter Draft",
    "",
    "This is a deterministic, coordinate-reconstructed adapter draft from Phase 2A IR. It is not an approved commission rule or a final rating.",
    "",
    "## Source identity",
    "",
    `- PDF: ${draft.sourceIdentity.fileName}`,
    `- Path: \`${draft.sourceIdentity.relativePath}\``,
    `- SHA-256: \`${draft.sourceIdentity.sha256}\``,
    `- Bytes: ${draft.sourceIdentity.byteSize}`,
    `- Phase 2A manifest verification: ${draft.inventory.manifestVerification.status}`,
    `- Printed effective date: ${draft.sourceEffectiveDateText.rawText ?? "not found"} → ${draft.sourceEffectiveDateText.value ?? "unknown"}`,
    `- Phase 2A effective-date status: ${draft.sourceIdentity.phase2aEffectiveDateStatus}`,
    "",
    "## Reconstructed inventory",
    "",
    `- Pages: ${draft.inventory.pageCount}`,
    `- Coordinate-bearing text items retained: ${draft.inventory.textItemCount} (${draft.inventory.pageTextItemCounts.map((page) => `page ${page.pageNumber}: ${page.count}`).join(", ")})`,
    `- Rate tables: ${draft.inventory.rateTableCount}`,
    `- Slab rows: ${draft.inventory.rateSlabRowCount}`,
    `- Rate cells: ${draft.inventory.rateCellCount}`,
    `- Geography rows / grouped table lines: ${draft.inventory.geographyRowCount}`,
    `- Relevant footnotes: ${draft.inventory.footnoteCount}`,
    "- Approved commission rules emitted: 0",
    "",
    "## Table scope",
    "",
  ];

  for (const table of draft.rateTables) {
    lines.push(
      `- ${table.zone} / ${table.productCategoryRaw} (${table.rateScope}): ${table.slabRows.length} slabs; ${table.slabRows.reduce((count, row) => count + row.cells.length, 0)} cells.`,
    );
  }
  lines.push(
    "- Slab endpoint/inclusivity semantics are not inferred; exact source labels are retained as non-executable strings.",
    "",
    "## Lookup and payout bases",
    "",
    `- Lookup/slab basis (insurer PDF): ${draft.semanticBasis.lookupSlabBasis.rawText}`,
    "- Payout basis (project-owner clarification): total net package premium (OD + TP/liability), GST excluded; a Package Rate is applied once.",
    "- Lookup basis and payout basis are separately represented.",
    "- OD and TP component rates for a Package table are `NOT_SEPARATELY_SPECIFIED`, not zero and not separate percentages.",
    "",
    "## Sample trace",
    "",
    `- Decision status: **${trace.decisionStatus}** (${trace.reasonCode})`,
    `- Policy issue-date anchor: ${trace.anchorDate}; grid effective from ${trace.selectedGridEffectiveFrom}.`,
    `- Policy product: ${trace.samplePolicy.productDescription}; table: ${trace.productTable}; location: Haryana → Zone 2.`,
    `- Current NCB: ${trace.samplePolicy.currentNcbPercent}%; net OD: ₹${trace.samplePolicy.netOwnDamagePremium}; net liability: ₹${trace.samplePolicy.netLiabilityPremium}; package net: ₹${trace.samplePolicy.totalNetPackagePremium}; GST: ₹${trace.samplePolicy.gst}.`,
    `- Fuel: ${trace.samplePolicy.fuel.policyStatus}; ${trace.samplePolicy.fuel.unapprovedExternalCorroboration}`,
    `- Conditional candidates only: ${trace.conditionalCandidates.map((candidate) => `${candidate.fuelGroupRaw}/${candidate.ncbGroupRaw}: ${candidate.ratePercent}% at ${candidate.slabLabelRaw} (slab page ${candidate.slabSource.pageNumber}, item ${candidate.slabSource.itemIndex}; rate page ${candidate.source.pageNumber}, item ${candidate.source.itemIndex})`).join("; ")}`,
    "- Final commission rate: withheld (null). Final payout: withheld (null).",
    `- Withholding reason: ${trace.withheldReason}`,
    "",
    "## Source footnotes",
    "",
    ...draft.footnotes.map((footnote) =>
      `- ${footnote.rawText} (page ${footnote.source.pageNumber}, item ${footnote.source.itemIndex})`),
    "",
    "## Phase 2A IR limitation",
    "",
    ...draft.layoutReconstruction.limitations.map((limitation) => `- ${limitation}`),
    "",
    "## Warnings",
    "",
    ...draft.warnings.map((warning) => `- ${warning.code}: ${warning.message}`),
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
  const absoluteInput = path.resolve(inputPath);
  const outputDirectory = path.resolve(outputPath);
  const inventory: unknown = JSON.parse(await readFile(absoluteInput, "utf8"));
  const draft = normalizeHdfcErgoInventory(inventory);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "hdfc-ergo-adapter-draft.json"),
    `${JSON.stringify(draft, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(outputDirectory, "HDFC-ERGO-ADAPTER-REPORT.md"),
    toMarkdown(draft),
    "utf8",
  );
  console.log(JSON.stringify({
    source: draft.sourceIdentity.relativePath,
    sha256: draft.sourceIdentity.sha256,
    pageCount: draft.inventory.pageCount,
    textItemCount: draft.inventory.textItemCount,
    rateTableCount: draft.inventory.rateTableCount,
    rateSlabRowCount: draft.inventory.rateSlabRowCount,
    rateCellCount: draft.inventory.rateCellCount,
    geographyRowCount: draft.inventory.geographyRowCount,
    footnoteCount: draft.inventory.footnoteCount,
    sampleStatus: draft.sampleResolutionTrace.decisionStatus,
    finalRatePercent: draft.sampleResolutionTrace.finalRatePercent,
    approvedCommissionRuleCount: 0,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
