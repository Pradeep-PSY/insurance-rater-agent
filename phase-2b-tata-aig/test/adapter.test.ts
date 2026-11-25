import { describe, expect, it } from "vitest";
import {
  inventoryDocumentForTataAig,
  normalizeTataAig,
} from "../src/adapter.js";
import type {
  SerializedGridCell,
  SerializedGridDocument,
  SerializedGridSheet,
} from "../src/phase-2a-ir.js";

const sourcePath =
  "raters/tata-aig/march-2026/Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx";
const sourceHash =
  "c62b657e7d819a250cb86549c177f88ff0277835d39a2a3e0d337fdc9915f879";
const sheetNames = [
  "General Guidelines",
  "cv checks",
  "pci checks",
  "Pvtcar",
  "CV",
  "TW",
  "Pvtcar_Extended Warranty",
];
const categories = [
  "Compact",
  "MPV SUV",
  "Mid Size",
  "Ultra High End",
  "Mini",
  "High End",
  "Quadricycle",
];

function cell(address: string, rawValue: SerializedGridCell["rawValue"], extra: Partial<SerializedGridCell> = {}): SerializedGridCell {
  return { address, rawValue, ...extra };
}

function emptySheet(name: string, order: number): SerializedGridSheet {
  return {
    name,
    order,
    visibility: name === "cv checks" || name === "pci checks" ? "HIDDEN" : "VISIBLE",
    dimension: null,
    actualRowCount: 0,
    actualColumnCount: 0,
    mergedRanges: [],
    cells: [],
  };
}

function fixtureDocument(): SerializedGridDocument {
  const sheets = sheetNames.map(emptySheet);
  const pvtcar = sheets[3]!;
  pvtcar.dimension = "A1:V535";
  pvtcar.actualRowCount = 535;
  pvtcar.actualColumnCount = 22;
  pvtcar.mergedRanges = ["A5:B5"];
  pvtcar.cells.push(
    cell("A5", "Merged grid title"),
    cell("V5", "DELHI"),
    cell("F1", "Effective from date rule"),
    cell("F3", "GWP based incremental COA applies"),
  );
  categories.forEach((type, index) => {
    const row = 511 + index * 4;
    pvtcar.cells.push(
      cell(`G${row}`, type),
      cell(`H${row}`, "Renewal"),
      cell(`I${row}`, "CNG"),
      cell(`J${row}`, "SATP"),
      cell(`K${row}`, "All"),
      cell(`L${row}`, "All"),
      cell(`V${row}`, 0.38, { numberFormat: "0.0%" }),
    );
  });
  const general = sheets[0]!;
  general.cells.push(
    cell("C5", "GWP-based increment exists"),
    cell("C12", "Policy specific"),
  );
  const pivot = sheets[2]!;
  pivot.cells.push(
    cell("A3", "Pivot"),
    cell("A4", { formula: "1+1", result: 2 }, { formula: "1+1", cachedValue: 2 }),
    cell("B4", "#VALUE!", { errorCode: "#VALUE!" }),
  );

  return {
    schemaVersion: "2A.0.0",
    source: {
      sourceId: "Tata AIG source",
      insurerId: "TATA_AIG",
      fileName: "Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx",
      relativePath: sourcePath,
      format: "XLSX",
      sha256: sourceHash,
      byteSize: 1479629,
      effectiveFrom: null,
      effectiveTo: null,
      effectiveDateStatus: "UNKNOWN",
    },
    workbook: { sheets },
    warnings: [],
  };
}

function fixtureInventory(document = fixtureDocument()): unknown {
  return {
    schemaVersion: "2A.0.0",
    generatedAt: "2026-11-24T08:21:08.770Z",
    formatVersion: 1,
    contents: {},
    manifestFound: true,
    manifestError: null,
    documents: [document],
    manifestVerifications: [{
      sourceId: "Tata AIG source",
      insurerId: "TATA_AIG",
      relativePath: sourcePath,
      absolutePath: "data/source-corpus/raters/tata-aig/source.xlsx",
      gridParseDisposition: "PARSE_XLSX",
      listedSha256: sourceHash,
      actualSha256: sourceHash,
      listedByteSize: document.source.byteSize,
      actualByteSize: document.source.byteSize,
      hashMatches: true,
      byteSizeMatches: true,
      exists: true,
      status: "PASS",
      error: null,
    }],
    compactSummary: {
      manifestPassCount: 1,
      manifestFailCount: 0,
      workbookCount: 1,
      pdfCount: 0,
      workbookSheetCount: 7,
      pdfPageCount: 0,
    },
    noCommissionRulesEmitted: true,
  };
}

describe("Tata AIG adapter", () => {
  it("preserves all seven type candidates as an invariant candidate without mapping Hatch Back", () => {
    const document = inventoryDocumentForTataAig(fixtureInventory());
    const draft = normalizeTataAig(document);
    const trace = draft.sampleResolutionTrace;

    expect(draft.sheetInventory).toHaveLength(7);
    expect(draft.validationSummary.hiddenSheetCount).toBe(2);
    expect(trace.candidateTypes.map((candidate) => candidate.typeCategory)).toEqual(categories);
    expect(trace.candidateTypes.map((candidate) => candidate.sourceRow)).toEqual([
      511, 515, 519, 523, 527, 531, 535,
    ]);
    expect(trace.candidateTypes.map((candidate) => candidate.rate.displayedPercent))
      .toEqual(Array(7).fill("38.0%"));
    expect(trace.baseCandidateStatus).toBe("INVARIANT_ACROSS_ALL_TYPES");
    expect(trace.bodyTypeToGridTypeMapping).toBe("NOT_ASSERTED");
    expect(trace.baseRateCandidate).toMatchObject({
      rawDecimal: "0.38",
      displayedPercent: "38.0%",
      basis: "NET_PREMIUM",
      approvedFinalRate: false,
    });
    expect(trace.baseRateCandidate?.basisEvidence.map((item) => `${item.sheet}!${item.cell}`))
      .toEqual(["General Guidelines!C7", "Pvtcar!F2"]);
    expect(trace.odApplicability).toBe("NOT_APPLICABLE");
    expect(trace.allInPayoutStatus).toBe("PENDING");
    expect(trace.sampleContext.coverStartDateUsedAsAnchor).toBe(false);
    expect(trace.sampleContext.intermediaryCode.value).toBe("721");
    expect(trace.sampleContext.netPremium.amountDecimal).toBe("2154");
    expect(trace.sampleContext.gst.amountDecimal).toBe("388");
    expect(trace.sampleContext.coverageGapContext.preservedWithoutReclassification).toBe(true);
    expect(draft.noApprovedCommissionRulesEmitted).toBe(true);
  });

  it("keeps override hierarchies independent and all-in payout stages pending", () => {
    const draft = normalizeTataAig(inventoryDocumentForTataAig(fixtureInventory()));

    expect(draft.overrideModel.ownerHighLevelHierarchy).toEqual([
      "SPECIAL_DEAL",
      "SPECIFIC_SUB_SEGMENT",
      "STANDARD_GRID",
    ]);
    expect(draft.overrideModel.detailedWorkbookSpecificity).toEqual([
      "POLICY_SPECIFIC",
      "FLEET_CODE",
      "PAN_SPECIFIC",
      "CODE_SPECIFIC",
      "STANDARD_GRID",
    ]);
    expect(draft.overrideModel.mappingBetweenHierarchies).toBe("NOT_DEFINED");
    expect(draft.coaAssessment.normalizedIncrementalRules).toEqual([]);
    expect(draft.coaAssessment.status).toBe("PENDING_INSUFFICIENT_EVIDENCE");
    expect(draft.coaAssessment.stalePivotContext.cachedPivotSourceRange).toBe("Pvtcar!G5:BO131");
    expect(draft.coaAssessment.stalePivotTreatment)
      .toBe("EXCLUDED_AS_CURRENT_COA_EVIDENCE");
    expect(draft.sampleResolutionTrace.stages.every((stage) => stage.status === "PENDING"))
      .toBe(true);
  });

  it("retains formula, cached value, error and merged-header ancestry independently", () => {
    const draft = normalizeTataAig(inventoryDocumentForTataAig(fixtureInventory()));
    const pivot = draft.sheetInventory.find((sheet) => sheet.name === "pci checks")!;
    const formula = pivot.formulaEvidence.find((evidence) => evidence.source.cell === "A4")!;
    const error = pivot.errorEvidence.find((evidence) => evidence.source.cell === "B4")!;
    const mergedHeader = draft.pvtcarMatrix.columnContexts
      .find((context) => context.column === "B")!
      .headerAncestry[0]!;

    expect(formula.formula).toBe("1+1");
    expect(formula.cachedValuePresent).toBe(true);
    expect(formula.cachedValue).toBe(2);
    expect(formula.errorCode).toBeNull();
    expect(error.formula).toBeNull();
    expect(error.cachedValuePresent).toBe(false);
    expect(error.cachedValue).toBeNull();
    expect(error.errorCode).toBe("#VALUE!");
    expect(mergedHeader.evidence.source.cell).toBe("A5");
    expect(mergedHeader.appliesThroughMergedRange).toBe("A5:B5");
  });

  it("rejects a source whose manifest verification does not match the IR identity", () => {
    const input = fixtureInventory() as {
      manifestVerifications: Array<Record<string, unknown>>;
    };
    input.manifestVerifications[0]!.status = "FAIL";
    expect(() => inventoryDocumentForTataAig(input)).toThrow(/integrity verification/);
  });

  it("fails closed if the Delhi candidate is not invariant across all seven types", () => {
    const document = fixtureDocument();
    const pvtcar = document.workbook!.sheets[3]!;
    pvtcar.cells.find((candidate) => candidate.address === "V535")!.rawValue = 0.39;
    expect(() => normalizeTataAig(document)).toThrow(/invariant Delhi/);
  });

  it("does not claim complete original-workbook coverage when the IR boundary differs", () => {
    const draft = normalizeTataAig(inventoryDocumentForTataAig(fixtureInventory()));
    expect(draft.matrixCoverage.status).toBe("COMPLETE_FOR_SERIALIZED_IR");
    expect(draft.matrixCoverage.boundaryDiscrepancy).toBe(true);
    expect(draft.matrixCoverage.note).toContain("no claim is made about cells absent from the IR");
  });
});
