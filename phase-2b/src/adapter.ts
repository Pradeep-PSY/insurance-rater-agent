import path from "node:path";
import {
  serializedGridDocumentSchema,
  inventoryInputSchema,
  type JsonValue,
  type SerializedGridCell,
  type SerializedGridDocument,
  type SerializedGridSheet,
} from "./phase-2a-ir.js";
import {
  adapterWarningSchema,
  goDigitSatpAdapterDraftSchema,
  policyInputSchema,
  rawCellEvidenceSchema,
  type GoDigitSatpAdapterDraft,
  type PolicyInput,
  type RtoMapping,
  type SatpRow,
} from "./schema.js";
import { z } from "zod";

const goDigitSourcePath =
  "raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx";
const goDigitSourceHash =
  "6efb7ca43e7dae72339601e4daebef015f0b486cde0cbb5a0f6524356e3ac034";

export const sampleContextSchema = z.object({
  policyInputs: policyInputSchema,
  segmentLabel: z.string().min(1).nullable(),
  ageYears: z.number().nonnegative().nullable(),
  segmentEvidence: z.array(z.object({
    sourceKind: z.enum(["POLICY_PDF", "INSURER_GRID", "PHASE_0_RULEBOOK"]),
    file: z.string().min(1),
    page: z.number().int().positive().optional(),
    sheet: z.string().min(1).optional(),
    cell: z.string().regex(/^[A-Z]+\d+$/).optional(),
    section: z.string().min(1).optional(),
  }).strict()),
}).strict();

export type SampleContext = z.infer<typeof sampleContextSchema>;

const samplePolicyPdf = "sample-policies/pvt-car-satp-go-digit.pdf";
const goDigitRulebook = "docs/phase-0/go-digit-rulebook.md";

export const goDigitSampleContext: SampleContext = {
  policyInputs: {
    registrationNumber: "UP78FZ1372",
    rtoCode: "UP78",
    fuel: "Petrol",
    cubicCapacityCc: 1086,
    manufactureYear: {
      rawValue: "0001-01-01",
      status: "INVALID",
    },
    currentInsurer: "Go Digit General Insurance Ltd.",
    previousInsurer: "Go Digit General Insurance Limited",
    businessType: "RENEWAL",
    businessTypeUsedForMatching: false,
    evidence: [
      { sourceKind: "POLICY_PDF", file: samplePolicyPdf, page: 1 },
      { sourceKind: "POLICY_PDF", file: samplePolicyPdf, page: 2 },
      {
        sourceKind: "PHASE_0_RULEBOOK",
        file: goDigitRulebook,
        section: "2. Policy facts extracted from the supplied PDF",
      },
    ],
  },
  segmentLabel: "Petrol>1000",
  ageYears: null,
  segmentEvidence: [
    { sourceKind: "POLICY_PDF", file: samplePolicyPdf, page: 1 },
    { sourceKind: "INSURER_GRID", file: goDigitSourcePath, sheet: "4W SATP", cell: "C293" },
    {
      sourceKind: "PHASE_0_RULEBOOK",
      file: goDigitRulebook,
      section: "3.2 SATP rate table",
    },
  ],
};

function getSheet(document: SerializedGridDocument, name: string): SerializedGridSheet {
  const sheet = document.workbook?.sheets.find((candidate) => candidate.name === name);
  if (!sheet) {
    throw new Error(`Required Go Digit workbook sheet is missing: "${name}"`);
  }
  return sheet;
}

function cellAt(sheet: SerializedGridSheet, column: string, row: number): SerializedGridCell | undefined {
  const address = `${column}${row}`;
  return sheet.cells.find((cell) => cell.address === address);
}

function rawString(value: JsonValue | undefined): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function rawCellEvidence(
  sheet: SerializedGridSheet,
  column: string,
  row: number,
): z.infer<typeof rawCellEvidenceSchema> {
  const address = `${column}${row}`;
  const cell = cellAt(sheet, column, row);
  const rawValue = cell?.rawValue ?? null;
  let cachedValue = cell?.cachedValue ?? null;

  if (cell?.formula && cachedValue === null &&
      typeof rawValue === "object" && rawValue !== null && !Array.isArray(rawValue) &&
      "result" in rawValue) {
    cachedValue = rawValue.result;
  }

  return rawCellEvidenceSchema.parse({
    source: { sheet: sheet.name, cell: address },
    rawValue,
    formula: cell?.formula ?? null,
    cachedValue,
    errorCode: cell?.errorCode ?? null,
    numberFormat: cell?.numberFormat ?? null,
  });
}

function normalizedRtoCode(rawRtoCode: string | null): string | null {
  if (rawRtoCode === null) return null;
  return rawRtoCode.trim().toUpperCase().replace(/[\s-]+/g, "");
}

function populatedRows(sheet: SerializedGridSheet, columns: string[], firstDataRow: number): number[] {
  const rows = new Set<number>();
  for (const cell of sheet.cells) {
    const match = /^([A-Z]+)(\d+)$/.exec(cell.address);
    if (!match || !columns.includes(match[1] ?? "")) continue;
    const row = Number(match[2]);
    if (row >= firstDataRow) rows.add(row);
  }
  return [...rows].sort((a, b) => a - b);
}

function mappingStatus(
  rows: RtoMapping[],
  row: RtoMapping,
): RtoMapping["mappingStatus"] {
  if (row.normalizedRtoCode === null) return "UNIQUE";
  const matches = rows.filter((candidate) => candidate.normalizedRtoCode === row.normalizedRtoCode);
  if (matches.length <= 1) return "UNIQUE";
  const clusters = new Set(matches.map((candidate) => candidate.productClusters.fourWtp));
  return clusters.size > 1 ? "CONFLICTING" : "DUPLICATE_CONSISTENT";
}

function buildRtoMappings(sheet: SerializedGridSheet): RtoMapping[] {
  const mappings = populatedRows(sheet, ["B", "C", "D", "E", "F"], 3)
    .map((row) => {
      const rtoCode = rawCellEvidence(sheet, "B", row);
      const fourWtp = rawCellEvidence(sheet, "C", row);
      const fourWPackage = rawCellEvidence(sheet, "D", row);
      const fourWSaod = rawCellEvidence(sheet, "E", row);
      const plr = rawCellEvidence(sheet, "F", row);
      return {
        sourceRow: row,
        rawRtoCode: rawString(rtoCode.rawValue),
        normalizedRtoCode: normalizedRtoCode(rawString(rtoCode.rawValue)),
        productClusters: {
          fourWtp: rawString(fourWtp.rawValue),
          fourWPackage: rawString(fourWPackage.rawValue),
          fourWSaod: rawString(fourWSaod.rawValue),
          plr: rawString(plr.rawValue),
        },
        cells: { rtoCode, fourWtp, fourWPackage, fourWSaod, plr },
        mappingStatus: "UNIQUE" as const,
      };
    });

  return mappings.map((mapping) => ({
    ...mapping,
    mappingStatus: mappingStatus(mappings, mapping),
  }));
}

function metricValue(rawValue: JsonValue): Pick<
  SatpRow["metric"],
  "valueKind" | "rawNumericValue"
> {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return { valueKind: "NUMERIC", rawNumericValue: String(rawValue) };
  }
  if (rawValue === null) {
    return { valueKind: "MISSING", rawNumericValue: null };
  }
  if (typeof rawValue === "string" && rawValue.trim().length === 0) {
    return { valueKind: "MISSING", rawNumericValue: null };
  }
  return { valueKind: "NON_NUMERIC", rawNumericValue: null };
}

function buildSatpRows(sheet: SerializedGridSheet): SatpRow[] {
  return populatedRows(sheet, ["A", "B", "C", "D", "E", "F"], 3)
    .map((row) => {
      const compositeKey = rawCellEvidence(sheet, "A", row);
      const clusterCell = rawCellEvidence(sheet, "B", row);
      const segmentCell = rawCellEvidence(sheet, "C", row);
      const ageCell = rawCellEvidence(sheet, "D", row);
      const metricCell = rawCellEvidence(sheet, "E", row);
      const noteCell = rawCellEvidence(sheet, "F", row);
      const metricKinds = metricValue(metricCell.rawValue);
      return {
        sourceRow: row,
        cluster: rawString(clusterCell.rawValue),
        segmentLabel: rawString(segmentCell.rawValue),
        ageCondition: rawString(ageCell.rawValue),
        metric: {
          fieldName: "Max CD2" as const,
          ...metricKinds,
          rawValue: metricCell.rawValue,
          numberFormat: metricCell.numberFormat,
          semanticStatus: "UNRESOLVED" as const,
          eligibleForCommissionOutput: false as const,
          source: metricCell.source,
        },
        note: rawString(noteCell.rawValue),
        cells: {
          compositeKey,
          cluster: clusterCell,
          segment: segmentCell,
          age: ageCell,
          maxCd2: metricCell,
          note: noteCell,
        },
        sourceRange: `B${row}:F${row}`,
      };
    });
}

function getConflicts(mappings: RtoMapping[]) {
  const byCode = new Map<string, RtoMapping[]>();
  for (const mapping of mappings) {
    if (mapping.normalizedRtoCode === null) continue;
    const entries = byCode.get(mapping.normalizedRtoCode) ?? [];
    entries.push(mapping);
    byCode.set(mapping.normalizedRtoCode, entries);
  }

  return [...byCode.entries()]
    .map(([normalizedCode, rows]) => ({
      normalizedRtoCode: normalizedCode,
      mappingRows: rows,
      distinctFourWtpClusters: [...new Set(rows.map((row) => row.productClusters.fourWtp))],
    }))
    .filter((conflict) => conflict.distinctFourWtpClusters.length > 1);
}

export function resolveSampleTrace(
  draft: Pick<GoDigitSatpAdapterDraft, "rtoMappings" | "satpRows">,
  contextInput: SampleContext,
) {
  const context = sampleContextSchema.parse(contextInput);
  const { policyInputs, segmentLabel } = context;
  const normalizedCode = normalizedRtoCode(policyInputs.rtoCode);
  const matchingMappings = draft.rtoMappings.filter(
    (mapping) => mapping.normalizedRtoCode === normalizedCode,
  );
  if (matchingMappings.length === 0) {
    return {
      status: "UNRESOLVED" as const,
      reasonCode: "MISSING_RTO_MAPPING" as const,
      policyInputs,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }

  const clusters = new Set(matchingMappings.map((mapping) => mapping.productClusters.fourWtp));
  if (clusters.size > 1) {
    return {
      status: "AMBIGUOUS" as const,
      reasonCode: "CONFLICTING_RTO_MAPPINGS" as const,
      policyInputs,
      rtoMapping: {
        normalizedRtoCode: normalizedCode ?? policyInputs.rtoCode,
        cluster: null,
        sourceRanges: matchingMappings.map((mapping) => `B${mapping.sourceRow}:C${mapping.sourceRow}`),
      },
      segmentSelection: {
        fuel: policyInputs.fuel,
        cubicCapacityCc: policyInputs.cubicCapacityCc,
        exactGridLabel: segmentLabel ?? "",
        derivationStatus: "SOURCE_GROUNDED_SAMPLE_INTERPRETATION" as const,
        evidence: context.segmentEvidence,
      },
      ageSelection: {
        condition: "",
        ageRequired: true,
        manufactureYearUsed: false as const,
      },
      candidateRows: [],
      rawMetric: null,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }

  const cluster = matchingMappings[0]?.productClusters.fourWtp ?? null;
  const sourceRanges = matchingMappings.map((mapping) => `B${mapping.sourceRow}:C${mapping.sourceRow}`);
  const firstMapping = matchingMappings[0];
  if (cluster === "All_India_Decline") {
    return {
      status: "DECLINED" as const,
      reasonCode: "ALL_INDIA_DECLINE" as const,
      policyInputs,
      rtoMapping: {
        normalizedRtoCode: normalizedCode ?? policyInputs.rtoCode,
        cluster: "All_India_Decline" as const,
        sourceRange: sourceRanges[0] ?? "",
      },
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }

  if (cluster === null || firstMapping?.mappingStatus === "CONFLICTING") {
    return {
      status: "UNRESOLVED" as const,
      reasonCode: "MISSING_RTO_MAPPING" as const,
      policyInputs,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }

  if (segmentLabel === null) {
    return {
      status: "UNRESOLVED" as const,
      reasonCode: "MISSING_SEGMENT" as const,
      policyInputs,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }

  const clusterSegmentRows = draft.satpRows.filter(
    (row) => row.cluster === cluster && row.segmentLabel === segmentLabel,
  );
  const conditionalAgeRows = clusterSegmentRows.filter((row) => row.ageCondition !== "All");
  if (clusterSegmentRows.length > 0 && context.ageYears === null &&
      conditionalAgeRows.length > 0 && !clusterSegmentRows.some((row) => row.ageCondition === "All")) {
    return {
      status: "UNRESOLVED" as const,
      reasonCode: "MISSING_AGE" as const,
      policyInputs,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }
  if (context.ageYears === 10 &&
      conditionalAgeRows.some((row) => row.ageCondition === "<10" || row.ageCondition === ">10") &&
      !clusterSegmentRows.some((row) => row.ageCondition === "All")) {
    return {
      status: "UNRESOLVED" as const,
      reasonCode: "AGE_BOUNDARY_UNDEFINED" as const,
      policyInputs,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }
  const candidates = clusterSegmentRows.filter((row) => {
    if (row.ageCondition === "All") return true;
    if (context.ageYears === null) return false;
    if (row.ageCondition === "<10") return context.ageYears < 10;
    if (row.ageCondition === ">10") return context.ageYears > 10;
    return false;
  });

  if (candidates.length === 0) {
    return {
      status: "UNRESOLVED" as const,
      reasonCode: "NO_SATP_CANDIDATE" as const,
      policyInputs,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }

  if (candidates.length > 1) {
    return {
      status: "AMBIGUOUS" as const,
      reasonCode: "MULTIPLE_SATP_CANDIDATES" as const,
      policyInputs,
      rtoMapping: {
        normalizedRtoCode: normalizedCode ?? policyInputs.rtoCode,
        cluster,
        sourceRanges,
      },
      segmentSelection: {
        fuel: policyInputs.fuel,
        cubicCapacityCc: policyInputs.cubicCapacityCc,
        exactGridLabel: segmentLabel,
        derivationStatus: "SOURCE_GROUNDED_SAMPLE_INTERPRETATION" as const,
        evidence: context.segmentEvidence,
      },
      ageSelection: {
        condition: "multiple",
        ageRequired: false,
        manufactureYearUsed: false as const,
      },
      candidateRows: candidates.map((row) => ({
        sourceRow: row.sourceRow,
        sourceRange: row.sourceRange,
      })),
      rawMetric: null,
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    };
  }

  const candidate = candidates[0];
  if (!candidate) {
    throw new Error("SATP candidate count changed unexpectedly.");
  }
  const noteAppliesUnresolved = candidate.note !== null;
  const rowSourceRange = candidate.sourceRange;
  const metricSource = candidate.metric.source;
  const traceSchemaInput = {
    status: "AMBIGUOUS" as const,
    reasonCode: noteAppliesUnresolved
      ? "EXCEPTION_SCOPE_UNRESOLVED" as const
      : "MAX_CD2_SEMANTICS_UNRESOLVED" as const,
    policyInputs,
    rtoMapping: {
      normalizedRtoCode: normalizedCode ?? policyInputs.rtoCode,
      cluster,
      sourceRanges,
    },
    segmentSelection: {
      fuel: policyInputs.fuel,
      cubicCapacityCc: policyInputs.cubicCapacityCc,
      exactGridLabel: segmentLabel,
      derivationStatus: "SOURCE_GROUNDED_SAMPLE_INTERPRETATION" as const,
      evidence: context.segmentEvidence,
    },
    ageSelection: {
      condition: candidate.ageCondition ?? "",
      ageRequired: candidate.ageCondition !== "All",
      manufactureYearUsed: false as const,
    },
    candidateRows: [{
      sourceRow: candidate.sourceRow,
      sourceRange: rowSourceRange,
    }],
    rawMetric: {
      ...candidate.metric,
      source: metricSource,
    },
    odApplicability: "NOT_APPLICABLE" as const,
    tpCommissionRate: null,
  };
  return traceSchemaInput;
}

export function normalizeGoDigitSatp(
  documentInput: SerializedGridDocument,
  sampleContext: SampleContext = goDigitSampleContext,
): GoDigitSatpAdapterDraft {
  const document = serializedGridDocumentSchema.parse(documentInput);
  if (document.source.relativePath !== goDigitSourcePath ||
      document.source.fileName !== path.posix.basename(goDigitSourcePath) ||
      document.source.insurerId !== "GO_DIGIT" ||
      document.source.format !== "XLSX") {
    throw new Error(
      `Unexpected Go Digit source identity: ${document.source.relativePath} (${document.source.format}/${document.source.insurerId}).`,
    );
  }
  if (document.source.sha256 !== goDigitSourceHash) {
    throw new Error(`Unexpected source SHA-256 for ${goDigitSourcePath}.`);
  }
  const parserBlockers = document.warnings.filter((warning) => warning.severity === "BLOCKER");
  if (parserBlockers.length > 0) {
    throw new Error(
      `Phase 2A inventory has parser blockers: ${parserBlockers.map((warning) => warning.code).join(", ")}`,
    );
  }

  const rtoSheet = getSheet(document, "4W  RTO");
  const satpSheet = getSheet(document, "4W SATP");
  const rtoHeader = rawString(cellAt(rtoSheet, "C", 2)?.rawValue);
  if (rtoHeader !== "4WTP") {
    throw new Error(`Expected "4WTP" in 4W  RTO!C2; found ${String(rtoHeader)}.`);
  }
  const satpHeaders = ["Cluster", "Segment", "Age", "Max CD2", "Note"];
  const actualSatpHeaders = ["B", "C", "D", "E", "F"].map(
    (column) => rawString(cellAt(satpSheet, column, 2)?.rawValue),
  );
  if (actualSatpHeaders.some((value, index) => value !== satpHeaders[index])) {
    throw new Error(`Unexpected 4W SATP header row: ${actualSatpHeaders.join(" | ")}`);
  }

  const rtoMappings = buildRtoMappings(rtoSheet);
  const rtoMappingConflicts = getConflicts(rtoMappings);
  const satpRows = buildSatpRows(satpSheet);
  const declineCandidates = [
    ...rtoMappings
      .filter((mapping) => mapping.productClusters.fourWtp === "All_India_Decline")
      .map((mapping) => ({
        kind: "RTO_CLUSTER_DECLINE" as const,
        rawRtoCode: mapping.rawRtoCode,
        normalizedRtoCode: mapping.normalizedRtoCode,
        cluster: "All_India_Decline" as const,
        source: mapping.cells.fourWtp.source,
      })),
    ...satpRows
      .filter((row) => row.cluster === "All_India_Decline")
      .map((row) => ({
        kind: "SATP_DECLINE_ROW" as const,
        sourceRow: row.sourceRow,
        cluster: "All_India_Decline" as const,
        rawMetric: row.metric,
        sourceRange: row.sourceRange,
      })),
  ];
  const exceptionCandidates = satpRows
    .filter((row) => row.note !== null && row.note.trim().length > 0)
    .map((row) => ({
      sourceRow: row.sourceRow,
      note: row.note ?? "",
      status: "UNRESOLVED_EXCEPTION" as const,
      source: row.cells.note.source,
      sourceRange: `F${row.sourceRow}`,
    }));

  const sourcePeriodLabel = document.source.sourcePeriodLabel ??
    document.source.relativePath.split("/")[2] ??
    null;
  const warnings = [
    adapterWarningSchema.parse({
      code: "SOURCE_PERIOD_LABEL_ONLY",
      message: "The March 2026 directory label is preserved as a source-period label only; effective date bounds remain unknown.",
      sourcePath: document.source.relativePath,
    }),
    adapterWarningSchema.parse({
      code: "OOXML_NUMERIC_LEXEME_NOT_AVAILABLE",
      message: "Phase 2A stores numeric cell values as JSON numbers; original OOXML numeric text cannot be recovered from this IR.",
      exampleCell: { sheet: "4W SATP", cell: "E293" },
    }),
    adapterWarningSchema.parse({
      code: "UNRESOLVED_EXCEPTION_NOTES",
      message: "SATP notes are preserved as unresolved exception candidates and are not generalized into blanket exclusions.",
      count: exceptionCandidates.length,
    }),
    adapterWarningSchema.parse({
      code: "CONFLICTING_RTO_MAPPINGS",
      message: "Conflicting normalized RTO codes are surfaced with all source rows; none are silently deduplicated.",
      count: rtoMappingConflicts.length,
    }),
  ];

  const baseDraft = {
    adapterVersion: "2B-GODIGIT-SATP-1.0.0" as const,
    sourceIdentity: {
      sourceId: document.source.sourceId,
      fileName: document.source.fileName,
      relativePath: document.source.relativePath,
      sha256: document.source.sha256,
      byteSize: document.source.byteSize,
      sourcePeriodLabel,
      sourcePeriodLabelProvenance: "PATH_LABEL_ONLY" as const,
      effectiveFrom: document.source.effectiveFrom,
      effectiveTo: document.source.effectiveTo,
      effectiveDateStatus: document.source.effectiveDateStatus,
      manifestPath: "data/source-corpus/MANIFEST.json",
    },
    productScope: "PRIVATE_CAR_SATP" as const,
    rtoMappings,
    rtoMappingConflicts,
    satpRows,
    declineCandidates,
    exceptionCandidates,
    sampleResolutionTrace: {
      status: "NOT_EVALUATED" as const,
      reason: "Sample context must be supplied explicitly; this adapter does not extract policy facts.",
      odApplicability: "NOT_APPLICABLE" as const,
      tpCommissionRate: null,
    },
    warnings,
    validationSummary: {
      rtoMappingCount: rtoMappings.length,
      satpRowCount: satpRows.length,
      declineMappingCount: rtoMappings.filter(
        (mapping) => mapping.productClusters.fourWtp === "All_India_Decline",
      ).length,
      declineSatpRowCount: satpRows.filter(
        (row) => row.cluster === "All_India_Decline",
      ).length,
      exceptionCandidateCount: exceptionCandidates.length,
      conflictingRtoCodeCount: rtoMappingConflicts.length,
      satpCompositeKeyFormulaCount: satpRows.filter(
        (row) => row.cells.compositeKey.formula !== null,
      ).length,
      approvedCommissionRuleCount: 0 as const,
    },
  };

  const validatedBase = goDigitSatpAdapterDraftSchema.parse(baseDraft);
  const sampleResolutionTrace = resolveSampleTrace(validatedBase, sampleContext);
  return goDigitSatpAdapterDraftSchema.parse({
    ...validatedBase,
    sampleResolutionTrace,
  });
}

export function inventoryDocumentForGoDigit(input: unknown): SerializedGridDocument {
  const inventory = inventoryInputSchema.parse(input);
  const documents = inventory.documents.filter(
    (document) => document.source.relativePath === goDigitSourcePath,
  );
  if (documents.length !== 1) {
    throw new Error(
      `Expected exactly one Phase 2A Go Digit workbook document; found ${documents.length}.`,
    );
  }
  const document = documents[0]!;
  const verificationEntries = inventory.manifestVerifications.filter(
    (entry) => entry.relativePath === goDigitSourcePath,
  );
  if (verificationEntries.length !== 1) {
    throw new Error(
      `Expected one manifest verification record for the Go Digit workbook; found ${verificationEntries.length}.`,
    );
  }
  const verification = verificationEntries[0]!;
  if (verification.status !== "PASS" ||
      verification.listedSha256 !== goDigitSourceHash ||
      verification.actualSha256 !== goDigitSourceHash ||
      verification.listedByteSize !== document.source.byteSize ||
      verification.actualByteSize !== document.source.byteSize) {
    throw new Error("Go Digit Phase 2A manifest integrity verification did not pass.");
  }
  if (document.source.sha256 !== goDigitSourceHash) {
    throw new Error("Go Digit Phase 2A document identity does not match the verified manifest hash.");
  }
  return document;
}

export const goDigitSourceIdentity = {
  relativePath: goDigitSourcePath,
  sha256: goDigitSourceHash,
};
