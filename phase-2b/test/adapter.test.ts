import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  goDigitSampleContext,
  inventoryDocumentForGoDigit,
  normalizeGoDigitSatp,
  resolveSampleTrace,
  sampleContextSchema,
  type SampleContext,
} from "../src/adapter.js";
import {
  serializedGridDocumentSchema,
  type SerializedGridCell,
  type SerializedGridDocument,
} from "../src/phase-2a-ir.js";
import type { GoDigitSatpAdapterDraft } from "../src/schema.js";

const inventoryPath = path.resolve(
  process.cwd(),
  "../phase-2a/artifacts/phase-2a-real-corpus/phase-2a-inventory.json",
);
let realDocument: SerializedGridDocument;
let realDraft: GoDigitSatpAdapterDraft;

function cell(
  address: string,
  rawValue: SerializedGridCell["rawValue"],
  extra: Partial<SerializedGridCell> = {},
): SerializedGridCell {
  return { address, rawValue, ...extra };
}

function syntheticDocument(options: {
  rtoRows?: Array<{ code: string; fourWtp: string; pkg?: string; saod?: string; plr?: string }>;
  satpRows?: Array<{ cluster: string; segment: string; age: string; metric: number; note?: string; formula?: boolean }>;
} = {}): SerializedGridDocument {
  const rtoRows = options.rtoRows ?? [{
    code: "UP78",
    fourWtp: "UP_Bad",
    pkg: "UP",
    saod: "UP",
    plr: "UP_GOOD2",
  }];
  const satpRows = options.satpRows ?? [{
    cluster: "UP_Bad",
    segment: "Petrol>1000",
    age: "All",
    metric: 0.295,
    formula: true,
  }];
  const rtoCells: SerializedGridCell[] = [
    cell("B2", "RTO Code"),
    cell("C2", "4WTP"),
    cell("D2", "4W Package"),
    cell("E2", "4WSAOD"),
    cell("F2", "PLR Cluster"),
  ];
  rtoRows.forEach((row, index) => {
    const r = index + 3;
    rtoCells.push(
      cell(`B${r}`, row.code),
      cell(`C${r}`, row.fourWtp),
      cell(`D${r}`, row.pkg ?? ""),
      cell(`E${r}`, row.saod ?? ""),
      cell(`F${r}`, row.plr ?? ""),
    );
  });
  const satpCells: SerializedGridCell[] = [
    cell("B2", "Cluster"),
    cell("C2", "Segment"),
    cell("D2", "Age"),
    cell("E2", "Max CD2", { numberFormat: "0.0%" }),
    cell("F2", "Note"),
  ];
  satpRows.forEach((row, index) => {
    const r = index + 3;
    satpCells.push(
      ...(row.formula
        ? [cell(`A${r}`, { formula: `B${r}&C${r}&D${r}`, result: `${row.cluster}${row.segment}${row.age}` }, {
            formula: `B${r}&C${r}&D${r}`,
            cachedValue: `${row.cluster}${row.segment}${row.age}`,
          })]
        : []),
      cell(`B${r}`, row.cluster),
      cell(`C${r}`, row.segment),
      cell(`D${r}`, row.age),
      cell(`E${r}`, row.metric, { numberFormat: "0.0%" }),
      ...(row.note ? [cell(`F${r}`, row.note)] : []),
    );
  });

  return serializedGridDocumentSchema.parse({
    schemaVersion: "2A.0.0",
    source: {
      sourceId: "Large Insurance Brokers Mar'26 - Shared.xlsx",
      insurerId: "GO_DIGIT",
      fileName: "Large Insurance Brokers Mar'26 - Shared.xlsx",
      relativePath: "raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx",
      format: "XLSX",
      sha256: "6efb7ca43e7dae72339601e4daebef015f0b486cde0cbb5a0f6524356e3ac034",
      byteSize: 468080,
      effectiveFrom: null,
      effectiveTo: null,
      effectiveDateStatus: "UNKNOWN",
    },
    workbook: {
      sheets: [
        {
          name: "4W  RTO",
          order: 0,
          visibility: "VISIBLE",
          dimension: null,
          actualRowCount: rtoRows.length + 1,
          actualColumnCount: 5,
          mergedRanges: [],
          cells: rtoCells,
        },
        {
          name: "4W SATP",
          order: 1,
          visibility: "VISIBLE",
          dimension: null,
          actualRowCount: satpRows.length + 1,
          actualColumnCount: 6,
          mergedRanges: [],
          cells: satpCells,
        },
      ],
    },
    warnings: [],
  });
}

function context(overrides: {
  rtoCode?: string;
  segmentLabel?: string | null;
  ageYears?: number | null;
} = {}): SampleContext {
  return sampleContextSchema.parse({
    policyInputs: {
      ...goDigitSampleContext.policyInputs,
      ...(overrides.rtoCode ? { rtoCode: overrides.rtoCode } : {}),
    },
    segmentLabel: overrides.segmentLabel === undefined
      ? goDigitSampleContext.segmentLabel
      : overrides.segmentLabel,
    ageYears: overrides.ageYears === undefined ? goDigitSampleContext.ageYears : overrides.ageYears,
    segmentEvidence: goDigitSampleContext.segmentEvidence,
  });
}

beforeAll(async () => {
  const inventory: unknown = JSON.parse(await readFile(inventoryPath, "utf8"));
  realDocument = inventoryDocumentForGoDigit(inventory);
  realDraft = normalizeGoDigitSatp(realDocument);
});

describe("Go Digit Phase 2B SATP adapter", () => {
  it("uses the verified Go Digit workbook identity and source hash", () => {
    expect(realDocument.source.relativePath)
      .toBe("raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx");
    expect(realDocument.source.sha256)
      .toBe("6efb7ca43e7dae72339601e4daebef015f0b486cde0cbb5a0f6524356e3ac034");
    expect(realDraft.sourceIdentity.sha256).toBe(realDocument.source.sha256);
  });

  it("requires the exact 4W  RTO sheet name with two spaces", () => {
    expect(realDraft.rtoMappings.length).toBeGreaterThan(0);
    expect(realDraft.rtoMappings.find((mapping) => mapping.rawRtoCode === "UP78")?.cells.rtoCode.source.sheet)
      .toBe("4W  RTO");
  });

  it("uses only the 4WTP mapping column for SATP matching", () => {
    const up78 = realDraft.rtoMappings.find((mapping) => mapping.rawRtoCode === "UP78");
    expect(up78?.productClusters).toEqual({
      fourWtp: "UP_Bad",
      fourWPackage: "UP",
      fourWSaod: "UP",
      plr: "UP_GOOD2",
    });
    expect(up78?.cells.fourWtp.source).toEqual({ sheet: "4W  RTO", cell: "C1609" });
  });

  it("cites the supplied UP78 to UP_Bad mapping at B1609:C1609", () => {
    const up78 = realDraft.rtoMappings.find((mapping) => mapping.rawRtoCode === "UP78");
    expect(up78).toMatchObject({
      sourceRow: 1609,
      rawRtoCode: "UP78",
      normalizedRtoCode: "UP78",
      productClusters: { fourWtp: "UP_Bad" },
    });
    expect(up78?.cells.rtoCode.source.cell).toBe("B1609");
    expect(up78?.cells.fourWtp.source.cell).toBe("C1609");
  });

  it("matches the sample dimensions to exactly 4W SATP row 293", () => {
    expect(realDraft.sampleResolutionTrace.status).toBe("AMBIGUOUS");
    if (realDraft.sampleResolutionTrace.status !== "AMBIGUOUS") return;
    expect(realDraft.sampleResolutionTrace.candidateRows).toEqual([
      { sourceRow: 293, sourceRange: "B293:F293" },
    ]);
    expect(realDraft.sampleResolutionTrace.rtoMapping.cluster).toBe("UP_Bad");
    expect(realDraft.sampleResolutionTrace.segmentSelection.exactGridLabel).toBe("Petrol>1000");
    expect(realDraft.sampleResolutionTrace.ageSelection.condition).toBe("All");
  });

  it("preserves the Max CD2 value and format without approving commission", () => {
    const row = realDraft.satpRows.find((candidate) => candidate.sourceRow === 293);
    expect(row?.metric).toMatchObject({
      fieldName: "Max CD2",
      valueKind: "NUMERIC",
      rawNumericValue: "0.295",
      numberFormat: "0.0%",
      semanticStatus: "UNRESOLVED",
      eligibleForCommissionOutput: false,
      source: { sheet: "4W SATP", cell: "E293" },
    });
    expect(realDraft.sampleResolutionTrace.status === "AMBIGUOUS"
      ? realDraft.sampleResolutionTrace.tpCommissionRate
      : undefined).toBeNull();
    expect(JSON.stringify(realDraft)).not.toContain("approvedCommissionRate");
  });

  it("counts all All_India_Decline mappings from source rows, not a hardcoded rule", () => {
    const sourceCount = realDocument.workbook?.sheets
      .find((sheet) => sheet.name === "4W  RTO")?.cells
      .filter((cell) => /^C\d+$/.test(cell.address) && cell.rawValue === "All_India_Decline").length ?? 0;
    expect(sourceCount).toBe(80);
    expect(realDraft.validationSummary.declineMappingCount).toBe(sourceCount);
    expect(realDraft.declineCandidates.filter((candidate) => candidate.kind === "RTO_CLUSTER_DECLINE"))
      .toHaveLength(sourceCount);
  });

  it("preserves SATP segment labels verbatim without defining a global segmentation formula", () => {
    const row = realDraft.satpRows.find((candidate) => candidate.sourceRow === 293);
    expect(row?.segmentLabel).toBe("Petrol>1000");
    expect(realDraft.sampleResolutionTrace.status === "AMBIGUOUS"
      ? realDraft.sampleResolutionTrace.segmentSelection.derivationStatus
      : undefined).toBe("SOURCE_GROUNDED_SAMPLE_INTERPRETATION");
    expect(realDraft.satpRows.some((candidate) => candidate.segmentLabel === "Petrol 1000-1500")).toBe(true);
  });

  it("allows Age=All without using the invalid manufacture year", () => {
    expect(realDraft.sampleResolutionTrace.status).toBe("AMBIGUOUS");
    if (realDraft.sampleResolutionTrace.status !== "AMBIGUOUS") return;
    expect(realDraft.sampleResolutionTrace.ageSelection).toEqual({
      condition: "All",
      ageRequired: false,
      manufactureYearUsed: false,
    });
    expect(realDraft.sampleResolutionTrace.policyInputs.manufactureYear).toEqual({
      rawValue: "0001-01-01",
      status: "INVALID",
    });
  });

  it("does not match an exact 10-year age to either adjacent age band", () => {
    const draft = normalizeGoDigitSatp(syntheticDocument({
      satpRows: [
        { cluster: "UP_Bad", segment: "Petrol>1000", age: "<10", metric: 0.2 },
        { cluster: "UP_Bad", segment: "Petrol>1000", age: ">10", metric: 0.3 },
      ],
    }), context({ ageYears: 10 }));
    expect(draft.sampleResolutionTrace).toMatchObject({
      status: "UNRESOLVED",
      reasonCode: "AGE_BOUNDARY_UNDEFINED",
    });
  });

  it("preserves all non-empty note text as unresolved cited exceptions", () => {
    const expectedRows = [27, 67, 68, 69, 70, 120, 163, 180, 244, 324];
    expect(realDraft.exceptionCandidates.map((candidate) => candidate.sourceRow)).toEqual(expectedRows);
    expect(realDraft.exceptionCandidates.every((candidate) =>
      candidate.status === "UNRESOLVED_EXCEPTION" &&
      candidate.source.sheet === "4W SATP" &&
      candidate.source.cell === `F${candidate.sourceRow}`,
    )).toBe(true);
    expect(realDraft.exceptionCandidates.find((candidate) => candidate.sourceRow === 67)?.note)
      .toBe("Few RTOs for 10+ age are declined");
  });

  it("surfaces conflicting normalized RTO mappings instead of choosing one", () => {
    const draft = normalizeGoDigitSatp(syntheticDocument({
      rtoRows: [
        { code: "UP-78", fourWtp: "UP_Bad" },
        { code: "UP78", fourWtp: "UP_Good" },
      ],
    }), context({ rtoCode: "UP78" }));
    expect(draft.rtoMappingConflicts).toHaveLength(1);
    expect(draft.rtoMappingConflicts[0]?.mappingRows).toHaveLength(2);
    expect(draft.sampleResolutionTrace).toMatchObject({
      status: "AMBIGUOUS",
      reasonCode: "CONFLICTING_RTO_MAPPINGS",
    });
  });

  it("returns an explicit unresolved result when the RTO is missing", () => {
    const draft = normalizeGoDigitSatp(syntheticDocument(), context({ rtoCode: "XX00" }));
    expect(draft.sampleResolutionTrace).toMatchObject({
      status: "UNRESOLVED",
      reasonCode: "MISSING_RTO_MAPPING",
    });
  });

  it("returns an explicit unresolved result when the segment is missing", () => {
    const draft = normalizeGoDigitSatp(syntheticDocument(), context({ segmentLabel: null }));
    expect(draft.sampleResolutionTrace).toMatchObject({
      status: "UNRESOLVED",
      reasonCode: "MISSING_SEGMENT",
    });
  });

  it("returns an explicit unresolved result when no SATP row matches", () => {
    const draft = normalizeGoDigitSatp(syntheticDocument(), context({ segmentLabel: "Unknown segment" }));
    expect(draft.sampleResolutionTrace).toMatchObject({
      status: "UNRESOLVED",
      reasonCode: "NO_SATP_CANDIDATE",
    });
  });

  it("returns an explicit ambiguous result for multiple matching SATP rows", () => {
    const draft = normalizeGoDigitSatp(syntheticDocument({
      satpRows: [
        { cluster: "UP_Bad", segment: "Petrol>1000", age: "All", metric: 0.2 },
        { cluster: "UP_Bad", segment: "Petrol>1000", age: "All", metric: 0.3 },
      ],
    }));
    expect(draft.sampleResolutionTrace).toMatchObject({
      status: "AMBIGUOUS",
      reasonCode: "MULTIPLE_SATP_CANDIDATES",
    });
  });

  it("preserves formula and cached value separately without recalculation", () => {
    const row = realDraft.satpRows.find((candidate) => candidate.sourceRow === 67);
    expect(row?.cells.compositeKey.formula).toBe("B67&C67&D67");
    expect(row?.cells.compositeKey.cachedValue).toBe("Delhi/NCRDiesel<1500All");
  });

  it("treats All_India_Decline as a decline, never a zero commission", () => {
    const draft = normalizeGoDigitSatp(syntheticDocument({
      rtoRows: [{ code: "XX00", fourWtp: "All_India_Decline" }],
      satpRows: [{ cluster: "All_India_Decline", segment: "Petrol>1000", age: "All", metric: 0 }],
    }), context({ rtoCode: "XX00" }));
    expect(draft.sampleResolutionTrace).toMatchObject({
      status: "DECLINED",
      reasonCode: "ALL_INDIA_DECLINE",
      tpCommissionRate: null,
      odApplicability: "NOT_APPLICABLE",
    });
    expect(draft.declineCandidates.every((candidate) =>
      candidate.kind === "RTO_CLUSTER_DECLINE" || candidate.kind === "SATP_DECLINE_ROW",
    )).toBe(true);
  });

  it("sets SATP OD to NOT_APPLICABLE and emits no approved commission rules", () => {
    expect(realDraft.sampleResolutionTrace.status).toBe("AMBIGUOUS");
    if (realDraft.sampleResolutionTrace.status !== "AMBIGUOUS") return;
    expect(realDraft.sampleResolutionTrace.odApplicability).toBe("NOT_APPLICABLE");
    expect(realDraft.validationSummary.approvedCommissionRuleCount).toBe(0);
    expect(realDraft).not.toHaveProperty("commissionRules");
  });

  it("retains the path-only period label without claiming effective dates", () => {
    expect(realDraft.sourceIdentity).toMatchObject({
      sourcePeriodLabel: "march-2026",
      sourcePeriodLabelProvenance: "PATH_LABEL_ONLY",
      effectiveFrom: null,
      effectiveTo: null,
      effectiveDateStatus: "UNKNOWN",
    });
  });
});
