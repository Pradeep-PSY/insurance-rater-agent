import { z } from "zod";
import { jsonValueSchema } from "./phase-2a-ir.js";

export const gridCellSourceSchema = z.object({
  sheet: z.string().min(1),
  cell: z.string().regex(/^[A-Z]+\d+$/),
}).strict();

export const rawCellEvidenceSchema = z.object({
  source: gridCellSourceSchema,
  rawValue: jsonValueSchema,
  formula: z.string().nullable(),
  cachedValue: jsonValueSchema.nullable(),
  errorCode: z.string().nullable(),
  numberFormat: z.string().nullable(),
}).strict();

export const rtoMappingStatusSchema = z.enum([
  "UNIQUE",
  "DUPLICATE_CONSISTENT",
  "CONFLICTING",
]);

export const rtoMappingSchema = z.object({
  sourceRow: z.number().int().positive(),
  rawRtoCode: z.string().nullable(),
  normalizedRtoCode: z.string().nullable(),
  productClusters: z.object({
    fourWtp: z.string().nullable(),
    fourWPackage: z.string().nullable(),
    fourWSaod: z.string().nullable(),
    plr: z.string().nullable(),
  }).strict(),
  cells: z.object({
    rtoCode: rawCellEvidenceSchema,
    fourWtp: rawCellEvidenceSchema,
    fourWPackage: rawCellEvidenceSchema,
    fourWSaod: rawCellEvidenceSchema,
    plr: rawCellEvidenceSchema,
  }).strict(),
  mappingStatus: rtoMappingStatusSchema,
}).strict();

export const rtoConflictSchema = z.object({
  normalizedRtoCode: z.string().min(1),
  mappingRows: z.array(rtoMappingSchema).min(2),
  distinctFourWtpClusters: z.array(z.string().nullable()).min(2),
}).strict();

export const rawMetricSchema = z.object({
  fieldName: z.literal("Max CD2"),
  valueKind: z.enum(["NUMERIC", "NON_NUMERIC", "MISSING"]),
  rawNumericValue: z.string().nullable(),
  rawValue: jsonValueSchema,
  numberFormat: z.string().nullable(),
  semanticStatus: z.literal("UNRESOLVED"),
  eligibleForCommissionOutput: z.literal(false),
  source: gridCellSourceSchema,
}).strict();

export const satpRowSchema = z.object({
  sourceRow: z.number().int().positive(),
  cluster: z.string().nullable(),
  segmentLabel: z.string().nullable(),
  ageCondition: z.string().nullable(),
  metric: rawMetricSchema,
  note: z.string().nullable(),
  cells: z.object({
    compositeKey: rawCellEvidenceSchema,
    cluster: rawCellEvidenceSchema,
    segment: rawCellEvidenceSchema,
    age: rawCellEvidenceSchema,
    maxCd2: rawCellEvidenceSchema,
    note: rawCellEvidenceSchema,
  }).strict(),
  sourceRange: z.string().min(1),
}).strict();

export const declineCandidateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("RTO_CLUSTER_DECLINE"),
    rawRtoCode: z.string().nullable(),
    normalizedRtoCode: z.string().nullable(),
    cluster: z.literal("All_India_Decline"),
    source: gridCellSourceSchema,
  }).strict(),
  z.object({
    kind: z.literal("SATP_DECLINE_ROW"),
    sourceRow: z.number().int().positive(),
    cluster: z.literal("All_India_Decline"),
    rawMetric: rawMetricSchema,
    sourceRange: z.string().min(1),
  }).strict(),
]);

export const exceptionCandidateSchema = z.object({
  sourceRow: z.number().int().positive(),
  note: z.string().min(1),
  status: z.literal("UNRESOLVED_EXCEPTION"),
  source: gridCellSourceSchema,
  sourceRange: z.string().min(1),
}).strict();

export const evidenceRefSchema = z.discriminatedUnion("sourceKind", [
  z.object({
    sourceKind: z.literal("POLICY_PDF"),
    file: z.string().min(1),
    page: z.number().int().positive(),
  }).strict(),
  z.object({
    sourceKind: z.literal("INSURER_GRID"),
    file: z.string().min(1),
    sheet: z.string().min(1),
    cell: z.string().regex(/^[A-Z]+\d+$/),
  }).strict(),
  z.object({
    sourceKind: z.literal("PHASE_0_RULEBOOK"),
    file: z.string().min(1),
    section: z.string().min(1),
  }).strict(),
]);

export const policyInputSchema = z.object({
  registrationNumber: z.string().min(1),
  rtoCode: z.string().min(1),
  fuel: z.string().min(1),
  cubicCapacityCc: z.number().positive(),
  manufactureYear: z.object({
    rawValue: z.string(),
    status: z.literal("INVALID"),
  }).strict(),
  currentInsurer: z.string().min(1),
  previousInsurer: z.string().min(1),
  businessType: z.literal("RENEWAL"),
  businessTypeUsedForMatching: z.literal(false),
  evidence: z.array(evidenceRefSchema).min(1),
}).strict();

export const sampleResolutionTraceSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("NOT_EVALUATED"),
    reason: z.string().min(1),
    odApplicability: z.literal("NOT_APPLICABLE"),
    tpCommissionRate: z.null(),
  }).strict(),
  z.object({
    status: z.literal("AMBIGUOUS"),
    reasonCode: z.enum([
      "MAX_CD2_SEMANTICS_UNRESOLVED",
      "CONFLICTING_RTO_MAPPINGS",
      "MULTIPLE_SATP_CANDIDATES",
      "EXCEPTION_SCOPE_UNRESOLVED",
    ]),
    policyInputs: policyInputSchema,
    rtoMapping: z.object({
      normalizedRtoCode: z.string(),
      cluster: z.string().nullable(),
      sourceRanges: z.array(z.string()).min(1),
    }).strict(),
    segmentSelection: z.object({
      fuel: z.string(),
      cubicCapacityCc: z.number().positive(),
      exactGridLabel: z.string(),
      derivationStatus: z.literal("SOURCE_GROUNDED_SAMPLE_INTERPRETATION"),
      evidence: z.array(evidenceRefSchema).min(1),
    }).strict(),
    ageSelection: z.object({
      condition: z.string(),
      ageRequired: z.boolean(),
      manufactureYearUsed: z.literal(false),
    }).strict(),
    candidateRows: z.array(z.object({
      sourceRow: z.number().int().positive(),
      sourceRange: z.string(),
    })),
    rawMetric: rawMetricSchema.nullable(),
    odApplicability: z.literal("NOT_APPLICABLE"),
    tpCommissionRate: z.null(),
  }).strict(),
  z.object({
    status: z.literal("DECLINED"),
    reasonCode: z.literal("ALL_INDIA_DECLINE"),
    policyInputs: policyInputSchema,
    rtoMapping: z.object({
      normalizedRtoCode: z.string(),
      cluster: z.literal("All_India_Decline"),
      sourceRange: z.string(),
    }).strict(),
    odApplicability: z.literal("NOT_APPLICABLE"),
    tpCommissionRate: z.null(),
  }).strict(),
  z.object({
    status: z.literal("UNRESOLVED"),
    reasonCode: z.enum([
      "MISSING_RTO_MAPPING",
      "MISSING_SEGMENT",
      "MISSING_AGE",
      "NO_SATP_CANDIDATE",
      "AGE_BOUNDARY_UNDEFINED",
    ]),
    policyInputs: policyInputSchema,
    odApplicability: z.literal("NOT_APPLICABLE"),
    tpCommissionRate: z.null(),
  }).strict(),
]);

export const adapterWarningSchema = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("SOURCE_PERIOD_LABEL_ONLY"),
    message: z.string().min(1),
    sourcePath: z.string().min(1),
  }).strict(),
  z.object({
    code: z.literal("OOXML_NUMERIC_LEXEME_NOT_AVAILABLE"),
    message: z.string().min(1),
    exampleCell: gridCellSourceSchema,
  }).strict(),
  z.object({
    code: z.literal("UNRESOLVED_EXCEPTION_NOTES"),
    message: z.string().min(1),
    count: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    code: z.literal("CONFLICTING_RTO_MAPPINGS"),
    message: z.string().min(1),
    count: z.number().int().nonnegative(),
  }).strict(),
]);

export const validationSummarySchema = z.object({
  rtoMappingCount: z.number().int().nonnegative(),
  satpRowCount: z.number().int().nonnegative(),
  declineMappingCount: z.number().int().nonnegative(),
  declineSatpRowCount: z.number().int().nonnegative(),
  exceptionCandidateCount: z.number().int().nonnegative(),
  conflictingRtoCodeCount: z.number().int().nonnegative(),
  satpCompositeKeyFormulaCount: z.number().int().nonnegative(),
  approvedCommissionRuleCount: z.literal(0),
}).strict();

export const goDigitSatpAdapterDraftSchema = z.object({
  adapterVersion: z.literal("2B-GODIGIT-SATP-1.0.0"),
  sourceIdentity: z.object({
    sourceId: z.string().min(1),
    fileName: z.string().min(1),
    relativePath: z.string().min(1),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    byteSize: z.number().int().positive(),
    sourcePeriodLabel: z.string().nullable(),
    sourcePeriodLabelProvenance: z.literal("PATH_LABEL_ONLY"),
    effectiveFrom: z.string().nullable(),
    effectiveTo: z.string().nullable(),
    effectiveDateStatus: z.enum(["EXPLICIT", "LABEL_ONLY", "CONFLICTING", "UNKNOWN"]),
    manifestPath: z.string().min(1),
  }).strict(),
  productScope: z.literal("PRIVATE_CAR_SATP"),
  rtoMappings: z.array(rtoMappingSchema),
  rtoMappingConflicts: z.array(rtoConflictSchema),
  satpRows: z.array(satpRowSchema),
  declineCandidates: z.array(declineCandidateSchema),
  exceptionCandidates: z.array(exceptionCandidateSchema),
  sampleResolutionTrace: sampleResolutionTraceSchema,
  warnings: z.array(adapterWarningSchema),
  validationSummary: validationSummarySchema,
}).strict();

export type GoDigitSatpAdapterDraft = z.infer<typeof goDigitSatpAdapterDraftSchema>;
export type RtoMapping = z.infer<typeof rtoMappingSchema>;
export type SatpRow = z.infer<typeof satpRowSchema>;
export type PolicyInput = z.infer<typeof policyInputSchema>;
