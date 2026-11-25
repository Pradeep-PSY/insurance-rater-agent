import { z } from "zod";
import { jsonValueSchema } from "./phase-2a-ir.js";

export const sourceLocatorSchema = z.object({
  sheet: z.string().min(1),
  cell: z.string().regex(/^[A-Z]+\d+$/),
}).strict();

export const cellEvidenceSchema = z.object({
  source: sourceLocatorSchema,
  rawValue: jsonValueSchema,
  formula: z.string().nullable(),
  cachedValue: jsonValueSchema.nullable(),
  errorCode: z.string().nullable(),
  numberFormat: z.string().nullable(),
}).strict();

export const rowEvidenceSchema = z.object({
  sheet: z.string().min(1),
  range: z.string().min(1),
}).strict();

export const workbookSheetSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  visibility: z.enum(["VISIBLE", "HIDDEN", "VERY_HIDDEN"]),
  dimension: z.string().nullable(),
  expectedSourceDimension: z.string().nullable(),
  dimensionMatchesExpected: z.boolean().nullable(),
  actualRowCount: z.number().int().nonnegative(),
  actualColumnCount: z.number().int().nonnegative(),
  mergedRanges: z.array(z.string()),
  nonEmptyCellCount: z.number().int().nonnegative(),
  formulaCount: z.number().int().nonnegative(),
  formulaErrorCount: z.number().int().nonnegative(),
  formulaCells: z.array(cellEvidenceSchema),
  formulaErrorCells: z.array(cellEvidenceSchema),
  isEmpty: z.boolean(),
  scope: z.enum(["MASTER_INDEX", "OUT_OF_SCOPE", "PRIVATE_CAR_MATRIX", "TERMS", "RTO_MAP", "MAKE_MODEL_MAP"]),
  rationale: z.string().min(1),
  relevantRanges: z.array(rowEvidenceSchema),
}).strict();

export const sourceIdentitySchema = z.object({
  insurerId: z.literal("RELIANCE_INDUSIND"),
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  byteSize: z.number().int().positive(),
  workbookPeriodLabel: z.object({
    value: z.literal("FEB 26"),
    provenance: z.literal("FILENAME_LABEL_ONLY"),
  }).strict(),
  privateCarSheetTitle: z.string().min(1),
  privateCarSheetPeriodLabel: z.object({
    value: z.literal("Jan-26"),
    provenance: z.literal("SHEET_TITLE_LABEL_ONLY"),
  }).strict(),
  effectiveFrom: z.null(),
  effectiveTo: z.null(),
  effectiveDateStatus: z.literal("UNKNOWN_OR_UNVERIFIED"),
  manifestPath: z.literal("data/source-corpus/MANIFEST.json"),
}).strict();

export const mappingStatusSchema = z.enum(["UNIQUE", "DUPLICATE_CONSISTENT", "CONFLICTING"]);

export const rtoMappingSchema = z.object({
  sourceRow: z.number().int().positive(),
  rawRegistrationPrefix: z.string().nullable(),
  normalizedRegistrationPrefix: z.string().nullable(),
  regionCity: z.string().nullable(),
  marketType: z.string().nullable(),
  zone: z.string().nullable(),
  sourceCells: z.object({
    registrationPrefix: cellEvidenceSchema,
    comparisonKey: cellEvidenceSchema,
    regionCity: cellEvidenceSchema,
    marketType: cellEvidenceSchema,
    zone: cellEvidenceSchema,
  }).strict(),
  status: mappingStatusSchema,
  conflictingRows: z.array(z.number().int().positive()),
}).strict();

export const makeModelMappingSchema = z.object({
  sourceRow: z.number().int().positive(),
  rawMake: z.string().nullable(),
  normalizedMake: z.string().nullable(),
  rawModel: z.string().nullable(),
  normalizedModel: z.string().nullable(),
  segment: z.string().nullable(),
  segmentUsedByRateMatrix: z.literal(false),
  sourceCells: z.object({
    make: cellEvidenceSchema,
    model: cellEvidenceSchema,
    segment: cellEvidenceSchema,
  }).strict(),
  status: mappingStatusSchema,
  conflictingRows: z.array(z.number().int().positive()),
}).strict();

export const mergedHeaderSchema = z.object({
  label: z.string().nullable(),
  source: sourceLocatorSchema,
  mergedRange: z.string().nullable(),
  ancestry: z.array(z.object({
    label: z.string().nullable(),
    source: sourceLocatorSchema,
    mergedRange: z.string().nullable(),
  }).strict()),
}).strict();

export const baseGridValueSchema = z.object({
  product: z.enum(["PETROL_BIFUEL_COMPREHENSIVE", "DIESEL_EV_COMPREHENSIVE", "STANDALONE_OD", "STANDALONE_TP"]),
  rawValue: jsonValueSchema,
  rawDecimalString: z.string().nullable(),
  numberFormat: z.string().nullable(),
  source: sourceLocatorSchema,
  evidence: cellEvidenceSchema,
  header: mergedHeaderSchema,
  eligibility: z.literal("CONDITIONAL_CANDIDATE_ONLY"),
}).strict();

export const baseGridRowSchema = z.object({
  sourceRow: z.number().int().positive(),
  zone: z.string().nullable(),
  regionCity: z.string().nullable(),
  zoneEvidence: cellEvidenceSchema,
  regionEvidence: cellEvidenceSchema,
  mergedZoneGroup: z.object({
    range: z.string().nullable(),
    anchor: sourceLocatorSchema,
    label: z.string().nullable(),
  }).strict(),
  products: z.array(baseGridValueSchema).length(4),
  sourceRange: rowEvidenceSchema,
}).strict();

export const termSchema = z.discriminatedUnion("termType", [
  z.object({
    termType: z.literal("PAYOUT_BASIS"),
    rawWording: z.string().min(1),
    basis: z.literal("OD_PREMIUM"),
    operation: z.literal("USE_AS_PAYOUT_BASIS"),
    condition: z.null(),
    unresolvedSemantics: z.array(z.string()),
    interpretationProvenance: z.literal("INSURER_GRID"),
    source: sourceLocatorSchema,
    evidence: cellEvidenceSchema,
  }).strict(),
  z.object({
    termType: z.literal("RELATIVE_ADJUSTMENT"),
    rawWording: z.string().min(1),
    operation: z.literal("MULTIPLY_RATE"),
    factor: z.literal("0.95"),
    condition: z.object({ engineCapacityCc: z.object({ lt: z.literal(1000) }).strict() }).strict(),
    unresolvedSemantics: z.array(z.string()),
    interpretationProvenance: z.literal("PROJECT_OWNER_CLARIFICATION"),
    clarificationDate: z.literal("2026-11-23"),
    source: sourceLocatorSchema,
    evidence: cellEvidenceSchema,
  }).strict(),
  z.object({
    termType: z.literal("UNRESOLVED_ADJUSTMENT"),
    rawWording: z.string().min(1),
    candidateValue: z.string().nullable(),
    condition: z.string().min(1),
    operation: z.null(),
    basis: z.null(),
    unresolvedSemantics: z.array(z.string()).min(1),
    interpretationProvenance: z.literal("INSURER_GRID_UNRESOLVED"),
    source: sourceLocatorSchema,
    evidence: cellEvidenceSchema,
  }).strict(),
  z.object({
    termType: z.literal("CONDITIONAL_FLAT_PAYOUT"),
    rawWording: z.string().min(1),
    candidateValue: z.literal("20"),
    condition: z.string().min(1),
    operation: z.null(),
    basis: z.null(),
    unresolvedSemantics: z.array(z.string()).min(1),
    interpretationProvenance: z.literal("INSURER_GRID_UNRESOLVED"),
    source: sourceLocatorSchema,
    evidence: cellEvidenceSchema,
  }).strict(),
  z.object({
    termType: z.literal("INCREMENTAL_PAYOUT"),
    rawWording: z.string().min(1),
    candidateValue: z.literal("2.5"),
    condition: z.string().min(1),
    operation: z.null(),
    basis: z.null(),
    unresolvedSemantics: z.array(z.string()).min(1),
    interpretationProvenance: z.literal("INSURER_GRID_UNRESOLVED"),
    source: sourceLocatorSchema,
    evidence: cellEvidenceSchema,
  }).strict(),
]);

export const contextualObservationSchema = z.object({
  row: z.number().int().positive(),
  section: z.string().nullable(),
  scopeStatus: z.literal("UNRESOLVED_SCOPE_NOT_APPLIED"),
  cells: z.array(cellEvidenceSchema).min(1),
}).strict();

export const masterGridRawCellSchema = cellEvidenceSchema;

export const policyFactSchema = z.object({
  rawValue: jsonValueSchema,
  normalizedValue: jsonValueSchema,
  status: z.enum(["PRESENT", "MISSING", "INVALID", "AMBIGUOUS", "UNVERIFIED"]),
  evidence: z.array(z.object({
    sourceKind: z.enum(["POLICY_PDF", "INSURER_GRID", "PROJECT_OWNER_CLARIFICATION"]),
    file: z.string().min(1),
    page: z.number().int().positive().nullable(),
    sheet: z.string().min(1).nullable(),
    cell: z.string().regex(/^[A-Z]+\d+$/).nullable(),
    section: z.string().nullable(),
  }).strict()),
  note: z.string().min(1).nullable(),
}).strict();

export const samplePolicyFactsSchema = z.object({
  currentInsurer: policyFactSchema,
  proposalBusinessWording: policyFactSchema,
  previousInsurer: policyFactSchema,
  existingRelianceCustomer: policyFactSchema,
  policyIssueDate: policyFactSchema,
  policyPeriod: policyFactSchema,
  vehicle: policyFactSchema,
  registrationNumber: policyFactSchema,
  engineCapacityCc: policyFactSchema,
  fuel: policyFactSchema,
  manufactureMonthYear: policyFactSchema,
  ncbDeduction: policyFactSchema,
  totalOdPremium: policyFactSchema,
  totalBasicLiabilityPremium: policyFactSchema,
  paBenefitsPremium: policyFactSchema,
  legalLiabilityPremium: policyFactSchema,
  totalLiabilityPremium: policyFactSchema,
  totalPackagePremium: policyFactSchema,
  gst: policyFactSchema,
}).strict();

export const sampleTraceSchema = z.object({
  status: z.literal("UNSUPPORTED"),
  reasonCode: z.literal("NO_TEMPORALLY_APPLICABLE_GRID"),
  policyIssueDate: policyFactSchema,
  dateAnchor: z.object({
    kind: z.literal("POLICY_ISSUE_DATE"),
    resolvedDate: z.literal("2025-12-12"),
    selectionRationale: z.string().min(1),
    evidence: z.array(policyFactSchema.shape.evidence.element).min(1),
  }).strict(),
  gridApplicability: z.literal("NOT_COVERED_FROM_AVAILABLE_EVIDENCE"),
  latestGridFallbackUsed: z.literal(false),
  policyFacts: samplePolicyFactsSchema,
  mappingOutcomes: z.object({
    rto: z.enum(["UNIQUE", "MISSING", "AMBIGUOUS"]),
    makeModel: z.enum(["UNIQUE", "MISSING", "AMBIGUOUS"]),
  }).strict(),
  rtoMappingCandidates: z.array(rtoMappingSchema),
  makeModelMappingCandidates: z.array(makeModelMappingSchema),
  candidate: z.object({
    sourceRow: z.number().int().positive().nullable(),
    sourceRange: z.string().nullable(),
    rates: z.array(z.object({
      product: baseGridValueSchema.shape.product,
      rawValue: jsonValueSchema,
      rateString: z.string().nullable(),
      source: sourceLocatorSchema,
      status: z.literal("NON_FINAL_CONDITIONAL_CANDIDATE"),
    }).strict()),
    relativeAdjustmentFactor: z.literal("0.95"),
    adjustmentConditionSatisfied: z.literal(true),
  }).strict(),
  finalCommissionRate: z.null(),
  finalPayoutAmount: z.null(),
  approvedCommissionRuleCount: z.literal(0),
}).strict();

export const adapterWarningSchema = z.object({
  code: z.enum([
    "EFFECTIVE_BOUNDS_UNKNOWN",
    "POLICY_FUEL_UNVERIFIED",
    "PREVIOUS_INSURER_MISSING",
    "SMALL_SEGMENT_NOT_A_RATE_DIMENSION",
    "UNRESOLVED_ADJUSTMENT_TERMS",
    "MASTER_GRID_PRIVATE_CAR_STP_ZERO_UNINTERPRETED",
    "ENABLER_SCOPE_UNRESOLVED",
    "PHASE_2A_DIMENSION_DIFFERS_FROM_SOURCE_EXPECTATION",
  ]),
  message: z.string().min(1),
  source: sourceLocatorSchema.nullable(),
  affectedSheets: z.array(z.string().min(1)),
}).strict();

export const validationSummarySchema = z.object({
  workbookSheetCount: z.number().int().nonnegative(),
  rtoMappingCount: z.number().int().nonnegative(),
  makeModelMappingCount: z.number().int().nonnegative(),
  baseGridRowCount: z.number().int().nonnegative(),
  termCount: z.number().int().nonnegative(),
  masterGridRawCellCount: z.number().int().nonnegative(),
  contextualObservationCount: z.number().int().nonnegative(),
  workbookFormulaCount: z.number().int().nonnegative(),
  workbookFormulaErrorCount: z.number().int().nonnegative(),
  approvedCommissionRuleCount: z.literal(0),
}).strict();

export const reliancePrivateCarAdapterDraftSchema = z.object({
  adapterVersion: z.literal("2B-RELIANCE-PRIVATE-CAR-1.0.0"),
  sourceIdentity: sourceIdentitySchema,
  workbookInventory: z.object({
    sheets: z.array(workbookSheetSchema).length(8),
    masterGridRawCells: z.array(masterGridRawCellSchema),
    contextualObservations: z.array(contextualObservationSchema),
    privateCarMatrixMergedRanges: z.array(z.string()),
    privateCarHeaderReconstruction: z.literal("RECONSTRUCTED_FROM_PHASE_2A_CELL_VALUES_AND_MERGED_RANGES"),
  }).strict(),
  rtoMappings: z.array(rtoMappingSchema),
  makeModelMappings: z.array(makeModelMappingSchema),
  baseGridRows: z.array(baseGridRowSchema),
  termsAndAdjustments: z.array(termSchema),
  sampleResolutionTrace: sampleTraceSchema,
  warnings: z.array(adapterWarningSchema),
  validationSummary: validationSummarySchema,
  approvedCommissionRules: z.array(z.never()).length(0),
}).strict();

export type ReliancePrivateCarAdapterDraft = z.infer<typeof reliancePrivateCarAdapterDraftSchema>;
export type PolicyFact = z.infer<typeof policyFactSchema>;
