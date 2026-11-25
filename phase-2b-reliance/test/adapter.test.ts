import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  inventoryDocumentForReliance,
  normalizeReliancePrivateCar,
} from "../src/adapter.js";
import type { SerializedGridDocument } from "../src/phase-2a-ir.js";
import type { ReliancePrivateCarAdapterDraft } from "../src/schema.js";

const defaultInventoryPath = path.resolve(
  process.cwd(),
  "../phase-2a/artifacts/phase-2a-real-corpus/phase-2a-inventory.json",
);
const inventoryPath = process.env.PHASE_2A_INVENTORY ?? defaultInventoryPath;
let realDocument: SerializedGridDocument;
let realDraft: ReliancePrivateCarAdapterDraft;
let verification: {
  relativePath: string;
  listedSha256: string | null;
  actualSha256: string | null;
  listedByteSize: number | null;
  actualByteSize: number | null;
  status: "PASS" | "FAIL";
};

function cloneRealDocument(): SerializedGridDocument {
  return structuredClone(realDocument);
}

beforeAll(async () => {
  const value: unknown = JSON.parse(await readFile(inventoryPath, "utf8"));
  const selected = inventoryDocumentForReliance(value);
  realDocument = selected.document;
  verification = selected.verification;
  realDraft = normalizeReliancePrivateCar(realDocument, verification);
}, 30_000);

describe("Reliance Phase 2B private-car adapter", () => {
  it("uses the manifest-verified original workbook identity", () => {
    expect(realDocument.source.relativePath)
      .toBe("raters/reliance-indusind/feb-2026/Reliance Broking Premier  FEB 26 Grid.xlsx");
    expect(realDocument.source.sha256)
      .toBe("50cd340b3ea5917d4fc6d55e720c14405f26d5076c059414b69a6c03ea7b3142");
    expect(realDocument.source.byteSize).toBe(1_928_494);
    expect(verification.status).toBe("PASS");
    expect(verification.listedSha256).toBe(realDocument.source.sha256);
    expect(verification.actualSha256).toBe(realDocument.source.sha256);
    expect(verification.listedByteSize).toBe(realDocument.source.byteSize);
    expect(verification.actualByteSize).toBe(realDocument.source.byteSize);
  });

  it("accounts for all eight exact sheets and preserves empty sheets", () => {
    expect(realDraft.workbookInventory.sheets.map((sheet) => sheet.name)).toEqual([
      "FEB'26 - Grid",
      "TW SCOOTER GRID",
      "PRIVATE CAR COMP, SAOD & STP",
      "Short Term Taxi",
      "Enabler, PO Guidelines & T&C",
      "Contest",
      "RTO List",
      "Make Model wise segment",
    ]);
    expect(realDraft.workbookInventory.sheets.find((sheet) => sheet.name === "Short Term Taxi"))
      .toMatchObject({ isEmpty: true, nonEmptyCellCount: 0 });
    expect(realDraft.workbookInventory.sheets.find((sheet) => sheet.name === "Contest"))
      .toMatchObject({ isEmpty: true, nonEmptyCellCount: 0 });
    expect(realDraft.workbookInventory.sheets.find((sheet) => sheet.name === "TW SCOOTER GRID"))
      .toMatchObject({ isEmpty: false, scope: "OUT_OF_SCOPE" });
  });

  it("preserves private-car merged ranges and reconstructs header ancestry", () => {
    expect(realDraft.workbookInventory.privateCarMatrixMergedRanges).toHaveLength(11);
    expect(realDraft.workbookInventory.privateCarMatrixMergedRanges).toContain("A11:A13");
    const row = realDraft.baseGridRows.find((candidate) => candidate.sourceRow === 11);
    expect(row?.mergedZoneGroup).toEqual({
      range: "A11:A13",
      anchor: { sheet: "PRIVATE CAR COMP, SAOD & STP", cell: "A11" },
      label: "NORTH",
    });
    expect(row?.products[0]?.header).toMatchObject({
      label: "Petrol/Bifuel/Comp",
      source: { sheet: "PRIVATE CAR COMP, SAOD & STP", cell: "C2" },
      ancestry: [
        { label: "Pvt Car Old Business Grid- Jan-26", mergedRange: "A1:F1" },
        { label: "NORTH", mergedRange: "A11:A13" },
      ],
    });
  });

  it("reports, but does not rewrite, the Phase 2A enabler dimension mismatch", () => {
    const sheet = realDraft.workbookInventory.sheets.find(
      (candidate) => candidate.name === "Enabler, PO Guidelines & T&C",
    );
    expect(sheet).toMatchObject({
      dimension: "A3:B62",
      expectedSourceDimension: "A3:J62",
      dimensionMatchesExpected: false,
    });
    expect(realDraft.warnings.find(
      (warning) => warning.code === "PHASE_2A_DIMENSION_DIFFERS_FROM_SOURCE_EXPECTATION",
    )?.affectedSheets).toContain("Enabler, PO Guidelines & T&C");
  });

  it("extracts UP16 mapping with the exact five-column row evidence", () => {
    const mapping = realDraft.rtoMappings.find((candidate) => candidate.normalizedRegistrationPrefix === "UP16");
    expect(mapping).toMatchObject({
      sourceRow: 1253,
      rawRegistrationPrefix: "UP-16",
      normalizedRegistrationPrefix: "UP16",
      regionCity: "Delhi",
      marketType: "T20",
      zone: "NORTH",
      status: "UNIQUE",
    });
    expect(Object.values(mapping!.sourceCells).map((cell) => cell.source.cell))
      .toEqual(["A1253", "B1253", "C1253", "D1253", "E1253"]);
  });

  it("extracts every RTO map row dynamically from the complete source table", () => {
    const sourceRows = new Set(
      realDocument.workbook!.sheets.find((sheet) => sheet.name === "RTO List")!.cells
        .map((cell) => Number(/\d+$/.exec(cell.address)?.[0] ?? 0))
        .filter((row) => row >= 2),
    );
    expect(realDraft.rtoMappings).toHaveLength(sourceRows.size);
    expect(realDraft.validationSummary.rtoMappingCount).toBe(sourceRows.size);
  });

  it("surfaces duplicate/conflicting normalized RTO mappings without deduplication", () => {
    const document = cloneRealDocument();
    const sheet = document.workbook!.sheets.find((candidate) => candidate.name === "RTO List")!;
    const duplicate = sheet.cells.find((cell) => cell.address === "B1252")!;
    duplicate.rawValue = "UP-16";
    const city = sheet.cells.find((cell) => cell.address === "C1252")!;
    city.rawValue = "Conflicting City";
    const draft = normalizeReliancePrivateCar(document, verification);
    const mappings = draft.rtoMappings.filter((mapping) => mapping.normalizedRegistrationPrefix === "UP16");
    expect(mappings).toHaveLength(2);
    expect(mappings.every((mapping) => mapping.status === "CONFLICTING")).toBe(true);
    expect(mappings.map((mapping) => mapping.sourceRow)).toContain(1253);
    expect(draft.sampleResolutionTrace.mappingOutcomes.rto).toBe("AMBIGUOUS");
  }, 30_000);

  it("extracts Renault Kwid mapping with exact source cells", () => {
    const mapping = realDraft.makeModelMappings.find(
      (candidate) => candidate.normalizedMake === "RENAULT" && candidate.normalizedModel === "KWID",
    );
    expect(mapping).toMatchObject({
      sourceRow: 397,
      rawMake: "RENAULT",
      rawModel: "KWID",
      segment: "SMALL",
      segmentUsedByRateMatrix: false,
      status: "UNIQUE",
    });
    expect(Object.values(mapping!.sourceCells).map((cell) => cell.source.cell))
      .toEqual(["A397", "B397", "C397"]);
  });

  it("extracts all make/model rows dynamically and preserves duplicate candidates", () => {
    const sourceRows = new Set(
      realDocument.workbook!.sheets.find((sheet) => sheet.name === "Make Model wise segment")!.cells
        .map((cell) => Number(/\d+$/.exec(cell.address)?.[0] ?? 0))
        .filter((row) => row >= 2),
    );
    expect(realDraft.makeModelMappings).toHaveLength(sourceRows.size);
    expect(realDraft.validationSummary.makeModelMappingCount).toBe(sourceRows.size);
    expect(realDraft.makeModelMappings.every((mapping) => mapping.segmentUsedByRateMatrix === false)).toBe(true);
  });

  it("normalizes the complete private-car matrix rather than only the sample row", () => {
    expect(realDraft.baseGridRows).toHaveLength(15);
    expect(realDraft.baseGridRows[0]?.sourceRow).toBe(3);
    expect(realDraft.baseGridRows.at(-1)?.sourceRow).toBe(17);
    expect(realDraft.validationSummary.baseGridRowCount).toBe(realDraft.baseGridRows.length);
  });

  it("preserves C11 through F11 raw values, number formats, and source locators", () => {
    const row = realDraft.baseGridRows.find((candidate) => candidate.sourceRow === 11)!;
    expect(row.products.map((product) => product.rawValue)).toEqual([22.5, 10, 20, 0]);
    expect(row.products.map((product) => product.source.cell)).toEqual(["C11", "D11", "E11", "F11"]);
    expect(row.products.map((product) => product.numberFormat)).toEqual(["0.0", "0.0", "0.0", "0.0"]);
    expect(row.products.every((product) => product.eligibility === "CONDITIONAL_CANDIDATE_ONLY")).toBe(true);
  });

  it("keeps explicit F11 zero distinct from missing and N/A", () => {
    const tp = realDraft.baseGridRows.find((candidate) => candidate.sourceRow === 11)!.products[3]!;
    expect(tp.rawValue).toBe(0);
    expect(tp.rawDecimalString).toBe("0");
    expect(tp.evidence.rawValue).toBe(0);
  });

  it("represents H2 as the OD Premium payout basis", () => {
    expect(realDraft.termsAndAdjustments[0]).toMatchObject({
      termType: "PAYOUT_BASIS",
      basis: "OD_PREMIUM",
      operation: "USE_AS_PAYOUT_BASIS",
      source: { sheet: "PRIVATE CAR COMP, SAOD & STP", cell: "H2" },
    });
  });

  it("represents H3 as a relative 0.95 multiplier with owner provenance", () => {
    expect(realDraft.termsAndAdjustments[1]).toMatchObject({
      termType: "RELATIVE_ADJUSTMENT",
      operation: "MULTIPLY_RATE",
      factor: "0.95",
      condition: { engineCapacityCc: { lt: 1000 } },
      interpretationProvenance: "PROJECT_OWNER_CLARIFICATION",
      clarificationDate: "2026-11-23",
      source: { sheet: "PRIVATE CAR COMP, SAOD & STP", cell: "H3" },
    });
  });

  it("keeps H4 reduction unresolved and inapplicable", () => {
    expect(realDraft.termsAndAdjustments[2]).toMatchObject({
      termType: "UNRESOLVED_ADJUSTMENT",
      operation: null,
      basis: null,
      unresolvedSemantics: expect.arrayContaining(["relative versus percentage-point reduction"]),
      source: { cell: "H4" },
    });
  });

  it("keeps H5 flat payout conditional with basis and operation unresolved", () => {
    expect(realDraft.termsAndAdjustments[3]).toMatchObject({
      termType: "CONDITIONAL_FLAT_PAYOUT",
      candidateValue: "20",
      operation: null,
      basis: null,
      source: { cell: "H5" },
    });
  });

  it("keeps H6 incremental payout conditional on sourcing", () => {
    expect(realDraft.termsAndAdjustments[4]).toMatchObject({
      termType: "INCREMENTAL_PAYOUT",
      candidateValue: "2.5",
      condition: "Tyre/RTI bundle is sourced",
      operation: null,
      basis: null,
      source: { cell: "H6" },
    });
  });

  it("keeps file and sheet labels separate and does not invent effective dates", () => {
    expect(realDraft.sourceIdentity).toMatchObject({
      workbookPeriodLabel: { value: "FEB 26", provenance: "FILENAME_LABEL_ONLY" },
      privateCarSheetTitle: "Pvt Car Old Business Grid- Jan-26",
      privateCarSheetPeriodLabel: { value: "Jan-26", provenance: "SHEET_TITLE_LABEL_ONLY" },
      effectiveFrom: null,
      effectiveTo: null,
      effectiveDateStatus: "UNKNOWN_OR_UNVERIFIED",
    });
  });

  it("returns unsupported for the December policy without a latest-grid fallback", () => {
    expect(realDraft.sampleResolutionTrace).toMatchObject({
      status: "UNSUPPORTED",
      reasonCode: "NO_TEMPORALLY_APPLICABLE_GRID",
      policyIssueDate: { normalizedValue: "2025-12-12" },
      dateAnchor: { kind: "POLICY_ISSUE_DATE", resolvedDate: "2025-12-12" },
      gridApplicability: "NOT_COVERED_FROM_AVAILABLE_EVIDENCE",
      latestGridFallbackUsed: false,
    });
    expect(realDraft.sampleResolutionTrace.rtoMappingCandidates[0]).toMatchObject({
      normalizedRegistrationPrefix: "UP16",
      regionCity: "Delhi",
      marketType: "T20",
      zone: "NORTH",
      sourceCells: {
        comparisonKey: { source: { cell: "B1253" } },
      },
    });
    expect(realDraft.sampleResolutionTrace.makeModelMappingCandidates[0]).toMatchObject({
      normalizedMake: "RENAULT",
      normalizedModel: "KWID",
      segment: "SMALL",
      sourceCells: { make: { source: { cell: "A397" } } },
    });
  });

  it("preserves proposal renewal wording separately from missing previous insurer", () => {
    expect(realDraft.sampleResolutionTrace.policyFacts.proposalBusinessWording)
      .toMatchObject({ normalizedValue: "RENEWAL", status: "PRESENT" });
    expect(realDraft.sampleResolutionTrace.policyFacts.previousInsurer)
      .toMatchObject({ normalizedValue: null, status: "MISSING" });
  });

  it("does not use the existing-customer checkbox as previous-insurer evidence", () => {
    expect(realDraft.sampleResolutionTrace.policyFacts.existingRelianceCustomer)
      .toMatchObject({ normalizedValue: "NO", status: "PRESENT" });
    expect(realDraft.sampleResolutionTrace.policyFacts.previousInsurer.evidence[0]?.file)
      .toBe("sample-policies/pvt-car-comprehensive-reliance.pdf");
  });

  it("keeps policy fuel unverified without approved external evidence", () => {
    expect(realDraft.sampleResolutionTrace.policyFacts.fuel)
      .toMatchObject({ normalizedValue: null, status: "UNVERIFIED" });
  });

  it("records OD Premium basis and package inputs without calculating unsupported payout", () => {
    expect(realDraft.termsAndAdjustments[0]?.termType).toBe("PAYOUT_BASIS");
    expect(realDraft.sampleResolutionTrace.policyFacts.totalOdPremium.normalizedValue).toBe("4714.00");
    expect(realDraft.sampleResolutionTrace.policyFacts.totalLiabilityPremium.normalizedValue).toBe("2519.00");
    expect(realDraft.sampleResolutionTrace.policyFacts.totalPackagePremium.normalizedValue).toBe("7233.00");
    expect(realDraft.sampleResolutionTrace.policyFacts.gst.normalizedValue).toBe("1302.00");
    expect(realDraft.sampleResolutionTrace.finalCommissionRate).toBeNull();
    expect(realDraft.sampleResolutionTrace.finalPayoutAmount).toBeNull();
  });

  it("preserves candidate rate values as non-final and never publishes 21.375%", () => {
    expect(realDraft.sampleResolutionTrace.candidate.sourceRange).toBe("A11:F11");
    expect(realDraft.sampleResolutionTrace.candidate.rates[0]).toMatchObject({
      product: "PETROL_BIFUEL_COMPREHENSIVE",
      rawValue: 22.5,
      rateString: "22.5",
      source: { sheet: "PRIVATE CAR COMP, SAOD & STP", cell: "C11" },
      status: "NON_FINAL_CONDITIONAL_CANDIDATE",
    });
    expect(realDraft.sampleResolutionTrace.candidate.relativeAdjustmentFactor).toBe("0.95");
    expect(JSON.stringify(realDraft.sampleResolutionTrace)).not.toContain("21.375");
    expect(realDraft.sampleResolutionTrace.finalCommissionRate).toBeNull();
  });

  it("does not use SMALL as a private-car rate dimension", () => {
    expect(realDraft.makeModelMappings.find((mapping) => mapping.normalizedModel === "KWID")?.segment)
      .toBe("SMALL");
    expect(realDraft.makeModelMappings.find((mapping) => mapping.normalizedModel === "KWID")?.segmentUsedByRateMatrix)
      .toBe(false);
    expect(realDraft.baseGridRows.every((row) => !("segment" in row))).toBe(true);
  });

  it("preserves PC STP master-grid zero cells without assigning commission semantics", () => {
    const raw = realDraft.workbookInventory.masterGridRawCells;
    for (const cell of ["AR5", "AS5", "AT5"]) {
      expect(raw.find((entry) => entry.source.cell === cell)?.rawValue).toBe(0);
    }
    expect(realDraft.warnings.some(
      (warning) => warning.code === "MASTER_GRID_PRIVATE_CAR_STP_ZERO_UNINTERPRETED",
    )).toBe(true);
  });

  it("preserves every enabler row as cited, unresolved context without applying it", () => {
    expect(realDraft.workbookInventory.contextualObservations.length).toBeGreaterThan(0);
    expect(realDraft.workbookInventory.contextualObservations.every((row) =>
      row.scopeStatus === "UNRESOLVED_SCOPE_NOT_APPLIED" &&
      row.cells.every((cell) => cell.source.sheet === "Enabler, PO Guidelines & T&C"),
    )).toBe(true);
    expect(realDraft.warnings.some((warning) => warning.code === "ENABLER_SCOPE_UNRESOLVED")).toBe(true);
  });

  it("preserves formula, cached value, error and number-format fields without recalculation", () => {
    const document = cloneRealDocument();
    const matrix = document.workbook!.sheets.find(
      (sheet) => sheet.name === "PRIVATE CAR COMP, SAOD & STP",
    )!;
    const value = matrix.cells.find((cell) => cell.address === "C11")!;
    value.formula = "22.5";
    value.cachedValue = 22.5;
    value.errorCode = "#VALUE!";
    const draft = normalizeReliancePrivateCar(document, verification);
    const cell = draft.baseGridRows.find((row) => row.sourceRow === 11)!.products[0]!.evidence;
    expect(cell).toMatchObject({
      formula: "22.5",
      cachedValue: 22.5,
      errorCode: "#VALUE!",
      numberFormat: "0.0",
    });
  }, 30_000);

  it("handles missing RTO and make/model mapping outcomes explicitly", () => {
    const document = cloneRealDocument();
    const rtoSheet = document.workbook!.sheets.find((sheet) => sheet.name === "RTO List")!;
    rtoSheet.cells.find((cell) => cell.address === "B1253")!.rawValue = "ZZ99";
    const modelSheet = document.workbook!.sheets.find((sheet) => sheet.name === "Make Model wise segment")!;
    modelSheet.cells.find((cell) => cell.address === "A397")!.rawValue = "OTHER";
    const matrix = document.workbook!.sheets.find(
      (sheet) => sheet.name === "PRIVATE CAR COMP, SAOD & STP",
    )!;
    matrix.cells.find((cell) => cell.address === "B11")!.rawValue = "Unknown Region";
    const draft = normalizeReliancePrivateCar(document, verification);
    expect(draft.sampleResolutionTrace.mappingOutcomes).toEqual({
      rto: "MISSING",
      makeModel: "MISSING",
    });
    expect(draft.sampleResolutionTrace.candidate).toMatchObject({
      sourceRow: null,
      sourceRange: null,
      rates: [],
    });
  }, 30_000);

  it("handles multiple candidate matrix rows explicitly instead of choosing one", () => {
    const document = cloneRealDocument();
    const matrix = document.workbook!.sheets.find(
      (sheet) => sheet.name === "PRIVATE CAR COMP, SAOD & STP",
    )!;
    matrix.cells.find((cell) => cell.address === "A12")!.rawValue = "NORTH";
    matrix.cells.find((cell) => cell.address === "B12")!.rawValue = "Delhi";
    const draft = normalizeReliancePrivateCar(document, verification);
    expect(draft.sampleResolutionTrace.candidate).toMatchObject({
      sourceRow: null,
      sourceRange: null,
      rates: [],
    });
  }, 30_000);

  it("emits no approved production commission rules", () => {
    expect(realDraft.approvedCommissionRules).toEqual([]);
    expect(realDraft.validationSummary.approvedCommissionRuleCount).toBe(0);
  });

  it("retains a source locator for every normalized mapping, matrix value, and term", () => {
    expect(realDraft.rtoMappings.every((mapping) =>
      Object.values(mapping.sourceCells).every((cell) => cell.source.sheet === "RTO List"),
    )).toBe(true);
    expect(realDraft.makeModelMappings.every((mapping) =>
      Object.values(mapping.sourceCells).every((cell) => cell.source.sheet === "Make Model wise segment"),
    )).toBe(true);
    expect(realDraft.baseGridRows.every((row) =>
      row.products.every((product) => product.source.sheet === "PRIVATE CAR COMP, SAOD & STP"),
    )).toBe(true);
    expect(realDraft.termsAndAdjustments.every((term) =>
      term.source.sheet === "PRIVATE CAR COMP, SAOD & STP",
    )).toBe(true);
  });
});
