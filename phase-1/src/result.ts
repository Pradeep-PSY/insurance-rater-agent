import { z } from "zod";
import { decimalStringSchema, insurerCodeSchema, moneySchema } from "./common.js";
import { evidenceReferenceSchema } from "./evidence.js";
import { policyFactsSchema } from "./policy.js";
import type { PolicyFacts } from "./policy.js";
import { gridSelectionResultSchema } from "./grid.js";

export const overallDecisionStatusSchema = z.enum(["RESOLVED", "UNSUPPORTED", "AMBIGUOUS"]);

export const processingStatusSchema = z.enum([
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

export const unresolvedReasonCodeSchema = z.enum([
  "MISSING_POLICY_FACT",
  "AMBIGUOUS_POLICY_FACT",
  "INVALID_POLICY_FACT",
  "GRID_DATE_ANCHOR_UNRESOLVED",
  "GRID_VERSION_NOT_COVERED",
  "MULTIPLE_GRID_VERSIONS",
  "UNDEFINED_RAW_METRIC",
  "MISSING_RULE",
  "CONFLICTING_RULES",
  "OVERRIDE_STATUS_UNVERIFIED",
  "INCREMENTAL_COA_MISSING_GWP",
  "INCREMENTAL_COA_MISSING_SLAB",
  "INCREMENTAL_COA_MISSING_INCREMENT",
  "ALL_INCLUSIVE_STATUS_UNRESOLVED",
  "DECLINE_EXCEPTION_UNVERIFIED",
  "SETTLEMENT_ACCOUNTING_UNRESOLVED",
  "HATCHBACK_TYPE_MAPPING_UNRESOLVED",
  "FUEL_PROVENANCE_UNAPPROVED",
  "RETROSPECTIVE_GRID_NOT_AUTHORIZED",
  "OTHER",
]);

export const rateDecisionStatusSchema = z.enum([
  "RESOLVED",
  "UNSUPPORTED",
  "AMBIGUOUS",
  "NOT_APPLICABLE",
  "NOT_SEPARATELY_SPECIFIED",
  "WITHHELD",
]);

export const rateComponentResultSchema = z.object({
  component: z.enum(["OD", "TP", "PACKAGE"]),
  applicability: z.enum(["APPLICABLE", "NOT_APPLICABLE", "NOT_SEPARATELY_SPECIFIED"]),
  status: rateDecisionStatusSchema,
  /** Approved effective rate. Null when unresolved or not separately rated. */
  ratePercent: decimalStringSchema.nullable(),
  /** Source-supported base/candidate rate, retained even if final rate is pending. */
  candidateRatePercent: decimalStringSchema.nullable(),
  premiumBasis: z.enum([
    "OD_NET_PREMIUM",
    "TP_NET_PREMIUM",
    "TOTAL_NET_PACKAGE_PREMIUM",
    "NET_PREMIUM",
    "GWP",
    "UNKNOWN",
    "NONE",
  ]),
  premiumBasisAmount: moneySchema.nullable(),
  matchedRuleIds: z.array(z.string()),
  evidence: z.array(evidenceReferenceSchema),
  reasons: z.array(z.string()),
}).superRefine((result, context) => {
  if (result.status === "RESOLVED" && (result.ratePercent === null || result.applicability !== "APPLICABLE")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A resolved rate requires an applicable component and a ratePercent." });
  }
  if (result.status === "NOT_APPLICABLE" && (result.applicability !== "NOT_APPLICABLE" || result.ratePercent !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "NOT_APPLICABLE requires not-applicable applicability and a null rate." });
  }
  if (result.status === "NOT_SEPARATELY_SPECIFIED" && (result.applicability !== "NOT_SEPARATELY_SPECIFIED" || result.ratePercent !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A component covered by a package rate must be marked not separately specified with a null component rate." });
  }
  if (["UNSUPPORTED", "AMBIGUOUS", "WITHHELD"].includes(result.status) && result.ratePercent !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "An unresolved decision cannot expose an approved effective rate." });
  }
});

export const decisionTraceStepSchema = z.object({
  sequence: z.number().int().positive(),
  stage: z.enum([
    "DOCUMENT_VALIDATION",
    "TEXT_EXTRACTION",
    "OCR",
    "POLICY_FACT_EXTRACTION",
    "FACT_VALIDATION",
    "BUSINESS_TYPE_CLASSIFICATION",
    "GRID_VERSION_SELECTION",
    "INSURER_SELECTION",
    "MAPPING",
    "RULE_MATCHING",
    "FOOTNOTE_EVALUATION",
    "OVERRIDE_EVALUATION",
    "RATE_RESOLUTION",
    "PAYOUT_CALCULATION",
    "SETTLEMENT",
    "FINALIZATION",
  ]),
  status: z.enum(["COMPLETED", "SKIPPED", "BLOCKED", "WARNING"]),
  decision: z.string().min(1),
  inputSummary: z.record(z.string(), z.unknown()).optional(),
  outputSummary: z.record(z.string(), z.unknown()).optional(),
  ruleIds: z.array(z.string()).default([]),
  evidence: z.array(evidenceReferenceSchema),
  warnings: z.array(z.string()).default([]),
}).strict();

export const settlementAdjustmentSchema = z.object({
  adjustmentId: z.string().min(1),
  category: z.enum(["TDS", "GST", "CLAWBACK", "ENDORSEMENT_REVERSAL", "OTHER"]),
  /** Signed amount: positive increases payable; negative reduces payable. */
  signedAmount: moneySchema,
  description: z.string().min(1),
  evidence: z.array(evidenceReferenceSchema).min(1),
}).strict();

export const payoutCalculationSchema = z.object({
  status: z.enum(["NOT_CALCULATED", "PENDING_EVIDENCE", "CALCULATED"]),
  baseCommissionRatePercent: decimalStringSchema.nullable(),
  baseCommissionAmount: moneySchema.nullable(),
  incrementalCoaStatus: z.enum(["NOT_CALCULATED", "PENDING_EVIDENCE", "CALCULATED", "NOT_APPLICABLE"]),
  incrementalCoaRatePercent: decimalStringSchema.nullable(),
  incrementalCoaAmount: moneySchema.nullable(),
  grossPayoutStatus: z.enum(["NOT_CALCULATED", "PENDING_EVIDENCE", "CALCULATED"]),
  grossPayout: moneySchema.nullable(),
  settlementAdjustments: z.array(settlementAdjustmentSchema),
  netPayableStatus: z.enum(["NOT_CALCULATED", "PENDING_EVIDENCE", "CALCULATED"]),
  netPayable: moneySchema.nullable(),
  notes: z.array(z.string()),
}).strict();

export interface AnalysisResultShape {
  schemaVersion: "1.0.0";
  runId: string;
  policyDocumentId: string;
  processedAt: string;
  processingStatus: z.infer<typeof processingStatusSchema>;
  overallStatus: z.infer<typeof overallDecisionStatusSchema>;
  policyFacts: PolicyFacts;
  insurer: z.infer<typeof insurerCodeSchema>;
  ruleBundleId: string | null;
  ruleBundleVersion: string | null;
  gridSelection: z.infer<typeof gridSelectionResultSchema>;
  rates: {
    od: z.infer<typeof rateComponentResultSchema>;
    tp: z.infer<typeof rateComponentResultSchema>;
    package: z.infer<typeof rateComponentResultSchema>;
  };
  sourceObservations: Array<{
    observationId: string;
    label: string;
    rawValue: string;
    meaningStatus: "VERIFIED" | "UNRESOLVED";
    eligibleForCommissionOutput: boolean;
    evidence: z.infer<typeof evidenceReferenceSchema>[];
  }>;
  payout: z.infer<typeof payoutCalculationSchema>;
  confidence: {
    level: "HIGH" | "MEDIUM" | "LOW" | "NOT_ASSESSED";
    reasons: string[];
  };
  trace: z.infer<typeof decisionTraceStepSchema>[];
  unresolvedIssues: Array<{
    issueId: string;
    category: "MISSING_FACT" | "AMBIGUOUS_FACT" | "GRID_VERSION" | "UNDEFINED_METRIC" | "MISSING_RULE" | "OVERRIDE" | "INCREMENTAL_COA" | "OTHER";
    description: string;
    blocking: boolean;
    reasonCodes: z.infer<typeof unresolvedReasonCodeSchema>[];
    evidence?: z.infer<typeof evidenceReferenceSchema>[] | undefined;
  }>;
}

const analysisResultShape = z.object({
  schemaVersion: z.literal("1.0.0"),
  runId: z.string().min(1),
  policyDocumentId: z.string().min(1),
  processedAt: z.string().datetime({ offset: true }),
  processingStatus: processingStatusSchema,
  overallStatus: overallDecisionStatusSchema,
  policyFacts: policyFactsSchema,
  insurer: insurerCodeSchema,
  ruleBundleId: z.string().min(1).nullable(),
  ruleBundleVersion: z.string().nullable(),
  gridSelection: gridSelectionResultSchema,
  rates: z.object({
    od: rateComponentResultSchema,
    tp: rateComponentResultSchema,
    package: rateComponentResultSchema,
  }).strict(),
  /** Raw source values such as Go Digit Max CD2; never silently reinterpret them. */
  sourceObservations: z.array(z.object({
    observationId: z.string().min(1),
    label: z.string().min(1),
    rawValue: z.string(),
    meaningStatus: z.enum(["VERIFIED", "UNRESOLVED"]),
    eligibleForCommissionOutput: z.boolean(),
    evidence: z.array(evidenceReferenceSchema).min(1),
  }).strict()),
  payout: payoutCalculationSchema,
  confidence: z.object({
    level: z.enum(["HIGH", "MEDIUM", "LOW", "NOT_ASSESSED"]),
    reasons: z.array(z.string()),
  }).strict(),
  trace: z.array(decisionTraceStepSchema),
  unresolvedIssues: z.array(z.object({
    issueId: z.string().min(1),
    category: z.enum(["MISSING_FACT", "AMBIGUOUS_FACT", "GRID_VERSION", "UNDEFINED_METRIC", "MISSING_RULE", "OVERRIDE", "INCREMENTAL_COA", "OTHER"]),
    description: z.string().min(1),
    blocking: z.boolean(),
    reasonCodes: z.array(unresolvedReasonCodeSchema).min(1),
    evidence: z.array(evidenceReferenceSchema).optional().default([]),
  }).strict()),
}).strict();

export type RateComponentResult = z.infer<typeof rateComponentResultSchema>;
export type DecisionTraceStep = z.infer<typeof decisionTraceStepSchema>;
export const analysisResultSchema: z.ZodType<
  AnalysisResultShape,
  z.ZodTypeDef,
  z.input<typeof analysisResultShape>
> = analysisResultShape;
export type AnalysisResult = AnalysisResultShape;
