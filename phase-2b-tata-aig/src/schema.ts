import { z } from "zod";
import { jsonValueSchema } from "./phase-2a-ir.js";

export const sourceCellSchema = z.object({
  sheet: z.string().min(1),
  cell: z.string().regex(/^[A-Z]+\d+$/),
}).strict();

export const sourceRefSchema = z.object({
  sourceKind: z.enum(["INSURER_GRID", "PHASE_0_RULEBOOK", "POLICY_PDF", "OWNER_CLARIFICATION"]),
  file: z.string().min(1),
  sheet: z.string().min(1).optional(),
  cell: z.string().regex(/^[A-Z]+\d+$/).optional(),
  page: z.number().int().positive().optional(),
  section: z.string().min(1).optional(),
  clarificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

export const rawCellEvidenceSchema = z.object({
  source: sourceCellSchema,
  rawValue: jsonValueSchema,
  formula: z.string().nullable(),
  cachedValuePresent: z.boolean(),
  cachedValue: jsonValueSchema.nullable(),
  errorCode: z.string().nullable(),
  numberFormat: z.string().nullable(),
}).strict();

export const sheetScopeSchema = z.enum([
  "GUIDELINES_AND_PRIORITY",
  "HIDDEN_CACHED_CHECKS",
  "BASE_PRIVATE_CAR_GRID",
  "OUT_OF_SCOPE_COMMERCIAL_VEHICLE_GRID",
  "OUT_OF_SCOPE_TWO_WHEELER_GRID",
  "OUT_OF_SCOPE_EXTENDED_WARRANTY_GRID",
]);

export const sheetInventorySchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  visibility: z.enum(["VISIBLE", "HIDDEN", "VERY_HIDDEN"]),
  scope: sheetScopeSchema,
  dimension: z.string().nullable(),
  actualRowCount: z.number().int().nonnegative(),
  actualColumnCount: z.number().int().nonnegative(),
  nonEmptyCellCount: z.number().int().nonnegative(),
  mergedRanges: z.array(z.string()),
  formulaCount: z.number().int().nonnegative(),
  formulaCachedValueCount: z.number().int().nonnegative(),
  errorCellCount: z.number().int().nonnegative(),
  formulaEvidence: z.array(rawCellEvidenceSchema),
  errorEvidence: z.array(rawCellEvidenceSchema),
}).strict();

export const matrixColumnContextSchema = z.object({
  column: z.string().regex(/^[A-Z]+$/),
  headerAncestry: z.array(z.object({
    evidence: rawCellEvidenceSchema,
    appliesThroughMergedRange: z.string().nullable(),
  }).strict()),
}).strict();

export const matrixRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  cells: z.array(rawCellEvidenceSchema).min(1),
}).strict();

export const baseCandidateSchema = z.object({
  sourceRow: z.number().int().positive(),
  typeCategory: z.string().min(1),
  dimensions: z.object({
    businessType: z.string(),
    fuelType: z.string(),
    section: z.string(),
    ncb: z.string(),
    addOn: z.string(),
    locationHeader: z.string(),
  }).strict(),
  rate: z.object({
    rawDecimal: z.string(),
    displayedPercent: z.string(),
    numberFormat: z.string().nullable(),
    evidence: rawCellEvidenceSchema,
  }).strict(),
  rowEvidence: z.array(rawCellEvidenceSchema).min(7),
}).strict();

export const stageStatusSchema = z.object({
  stage: z.enum([
    "DATE_ANCHOR",
    "ACTIVE_GRID_VERSION",
    "OVERRIDE_SELECTION",
    "INCREMENTAL_COA",
    "GROSS_PAYOUT",
    "SETTLEMENT",
  ]),
  status: z.enum(["PENDING", "NOT_APPLICABLE", "CANDIDATE_ONLY"]),
  reason: z.string().min(1),
  evidence: z.array(sourceRefSchema),
}).strict();

export const sampleTraceSchema = z.object({
  policyClass: z.literal("PRIVATE_CAR_SATP"),
  bodyType: z.literal("Hatch Back"),
  bodyTypeToGridTypeMapping: z.literal("NOT_ASSERTED"),
  knownDimensions: z.object({
    businessType: z.literal("Renewal"),
    fuelType: z.literal("CNG"),
    section: z.literal("SATP"),
    ncb: z.literal("All"),
    addOn: z.literal("All"),
    locationHeader: z.literal("DELHI"),
  }).strict(),
  sampleContext: z.object({
    policyIssueDateStatus: z.literal("NOT_ESTABLISHED"),
    insurerDefinedLoginDateStatus: z.literal("UNKNOWN"),
    coverStartDate: z.literal("2026-04-01"),
    coverStartDateUsedAsAnchor: z.literal(false),
    intermediaryCode: z.object({
      value: z.literal("721"),
      evidence: z.array(sourceRefSchema).min(1),
    }).strict(),
    netPremium: z.object({
      amountDecimal: z.literal("2154"),
      currency: z.literal("INR"),
      premiumBasis: z.literal("NET_PREMIUM"),
      evidence: z.array(sourceRefSchema).min(1),
    }).strict(),
    gst: z.object({
      amountDecimal: z.literal("388"),
      currency: z.literal("INR"),
      excludedFromNetPremiumBasis: z.literal(true),
      evidence: z.array(sourceRefSchema).min(1),
    }).strict(),
    sameInsurerRenewal: z.literal(true),
    coverageGapContext: z.object({
      previousPolicyExpiryDate: z.literal("2024-08-30"),
      currentCoverStartDate: z.literal("2026-04-01"),
      preservedWithoutReclassification: z.literal(true),
    }).strict(),
    evidence: z.array(sourceRefSchema).min(1),
  }).strict(),
  baseCandidateStatus: z.enum(["INVARIANT_ACROSS_ALL_TYPES", "NOT_PROVEN_INVARIANT"]),
  candidateTypes: z.array(baseCandidateSchema),
  baseRateCandidate: z.object({
    rawDecimal: z.string(),
    displayedPercent: z.string(),
    basis: z.literal("NET_PREMIUM"),
    approvedFinalRate: z.literal(false),
    basisEvidence: z.array(sourceRefSchema).min(2),
  }).strict().nullable(),
  odApplicability: z.literal("NOT_APPLICABLE"),
  allInPayoutStatus: z.literal("PENDING"),
  stages: z.array(stageStatusSchema).length(6),
  policyEvidence: z.array(sourceRefSchema).min(1),
}).strict();

export const overrideModelSchema = z.object({
  ownerHighLevelHierarchy: z.array(z.enum(["SPECIAL_DEAL", "SPECIFIC_SUB_SEGMENT", "STANDARD_GRID"])).length(3),
  detailedWorkbookSpecificity: z.array(z.enum([
    "POLICY_SPECIFIC",
    "FLEET_CODE",
    "PAN_SPECIFIC",
    "CODE_SPECIFIC",
    "STANDARD_GRID",
  ])).length(5),
  mappingBetweenHierarchies: z.literal("NOT_DEFINED"),
  evidence: z.object({
    ownerClarification: sourceRefSchema,
    detailedSpecificity: z.array(sourceRefSchema).min(5),
    inconsistency: sourceRefSchema,
  }).strict(),
  overrideDataStatus: z.literal("NOT_SUPPLIED"),
}).strict();

export const coaAssessmentSchema = z.object({
  status: z.literal("PENDING_INSUFFICIENT_EVIDENCE"),
  sourceMentionsIncrement: z.array(sourceRefSchema).min(2),
  stalePivotTreatment: z.literal("EXCLUDED_AS_CURRENT_COA_EVIDENCE"),
  stalePivotContext: z.object({
    sheet: z.literal("pci checks"),
    cachedPivotSourceRange: z.literal("Pvtcar!G5:BO131"),
    phase0DocumentedPvtcarExtent: z.literal("A1:BR568"),
    cachedPivotRefreshDate: z.literal("2024-04-23"),
    evidence: sourceRefSchema,
  }).strict(),
  missingInputs: z.array(z.enum([
    "ACTIVE_POLICY_DATE_OR_INSURER_DEFINED_LOGIN_DATE",
    "CURRENT_GWP_SLAB_THRESHOLDS",
    "PRODUCER_GWP_AND_MEASUREMENT_WINDOW",
    "INCREMENT_VALUE_AND_BASIS",
    "BASE_RULE_ALL_INCLUSIVE_STATUS",
    "ELIGIBILITY_AND_OVERRIDE_EVIDENCE",
  ])).min(6),
  normalizedIncrementalRules: z.array(z.never()),
}).strict();

export const adapterWarningSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["INFO", "WARNING", "BLOCKER"]),
  message: z.string().min(1),
  evidence: z.array(sourceRefSchema),
}).strict();

export const tataAigAdapterDraftSchema = z.object({
  schemaVersion: z.literal("2B.TATA_AIG.1.0"),
  sourceIdentity: z.object({
    insurerId: z.literal("TATA_AIG"),
    fileName: z.string().min(1),
    relativePath: z.string().min(1),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    byteSize: z.number().int().positive(),
    sourcePeriodLabel: z.string().nullable(),
    effectiveFrom: z.string().nullable(),
    effectiveTo: z.string().nullable(),
    effectiveDateStatus: z.enum(["EXPLICIT", "LABEL_ONLY", "CONFLICTING", "UNKNOWN"]),
    sourceIdentityVerification: z.literal("PASS"),
  }).strict(),
  sheetInventory: z.array(sheetInventorySchema).length(7),
  matrixCoverage: z.object({
    status: z.literal("COMPLETE_FOR_SERIALIZED_IR"),
    sourceDimension: z.string().nullable(),
    phase0DocumentedDimension: z.string(),
    boundaryDiscrepancy: z.boolean(),
    note: z.string().min(1),
  }).strict(),
  pvtcarMatrix: z.object({
    sheet: z.literal("Pvtcar"),
    headerRows: z.array(z.number().int().positive()),
    columnContexts: z.array(matrixColumnContextSchema),
    rows: z.array(matrixRowSchema).min(1),
    sourceCellCount: z.number().int().positive(),
    mergedRangeCount: z.number().int().nonnegative(),
  }).strict(),
  overrideModel: overrideModelSchema,
  coaAssessment: coaAssessmentSchema,
  sampleResolutionTrace: sampleTraceSchema,
  warnings: z.array(adapterWarningSchema),
  noApprovedCommissionRulesEmitted: z.literal(true),
  validationSummary: z.object({
    sheetCount: z.literal(7),
    hiddenSheetCount: z.number().int().nonnegative(),
    pvtcarMatrixRowCount: z.number().int().positive(),
    pvtcarCellCount: z.number().int().positive(),
    formulaCount: z.number().int().nonnegative(),
    formulaCachedValueCount: z.number().int().nonnegative(),
    errorCellCount: z.number().int().nonnegative(),
    mergedRangeCount: z.number().int().nonnegative(),
    candidateTypeCount: z.number().int().nonnegative(),
    approvedCommissionRuleCount: z.literal(0),
  }).strict(),
}).strict();

export type RawCellEvidence = z.infer<typeof rawCellEvidenceSchema>;
export type TataAigAdapterDraft = z.infer<typeof tataAigAdapterDraftSchema>;
