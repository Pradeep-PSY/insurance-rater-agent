import { z } from "zod";
import {
  decimalStringSchema,
  isoDateSchema,
  insurerCodeSchema,
  jsonValueSchema,
} from "./common.js";
import { evidenceReferenceSchema } from "./evidence.js";

export const gridDateAnchorSchema = z.enum([
  "POLICY_ISSUE_DATE",
  "LOGIN_DATE",
  "INSURER_DEFINED",
  "NOT_SPECIFIED",
]);

export const gridSourceSchema = z
  .object({
    sourceId: z.string().min(1),
    fileName: z.string().min(1),
    format: z.enum(["XLSX", "PDF"]),
    sha256: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .optional(),
    parserVersion: z.string().optional(),
    effectiveFrom: isoDateSchema.nullable(),
    effectiveTo: isoDateSchema.nullable(),
    dateAnchor: gridDateAnchorSchema,
    effectiveDateEvidence: z.array(evidenceReferenceSchema),
  })
  .strict();

export const gridSelectionCoverageStatusSchema = z.enum([
  "COVERED",
  "NOT_COVERED",
  "ANCHOR_UNRESOLVED",
  "AMBIGUOUS",
]);

export const gridSelectionResultSchema = z
  .object({
    insurer: insurerCodeSchema,
    dateAnchorKind: gridDateAnchorSchema,
    resolvedAnchorDate: isoDateSchema.nullable(),
    selectedBundleId: z.string().min(1).nullable(),
    selectedBundleVersion: z.string().min(1).nullable(),
    selectedSourceId: z.string().min(1).nullable(),
    effectiveFrom: isoDateSchema.nullable(),
    effectiveTo: isoDateSchema.nullable(),
    coverageStatus: gridSelectionCoverageStatusSchema,
    selectionEvidence: z.array(evidenceReferenceSchema).min(1),
    unresolvedReasonCode: z.enum([
      "NO_COVERING_GRID",
      "ANCHOR_DATE_MISSING",
      "ANCHOR_DATE_CONFLICT",
      "RETROSPECTIVE_APPLICATION_NOT_AUTHORIZED",
      "MULTIPLE_COVERING_GRIDS",
      "NONE",
    ]),
    reason: z.string().min(1),
  })
  .strict()
  .superRefine((selection, context) => {
    if (selection.coverageStatus === "COVERED") {
      if (
        !selection.selectedBundleId ||
        !selection.selectedBundleVersion ||
        !selection.selectedSourceId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "COVERED selection requires selected bundle and source identifiers.",
        });
      }
    }
    if (
      selection.coverageStatus === "ANCHOR_UNRESOLVED" &&
      selection.resolvedAnchorDate !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ANCHOR_UNRESOLVED cannot expose a resolved anchor date.",
      });
    }
    if (
      selection.coverageStatus === "NOT_COVERED" &&
      selection.resolvedAnchorDate === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NOT_COVERED requires a resolved anchor date.",
      });
    }
  });

export const mappingTypeSchema = z.enum([
  "RTO_TO_ZONE",
  "RTO_TO_CLUSTER",
  "VEHICLE_TO_SEGMENT",
  "MAKE_MODEL_TO_SEGMENT",
  "FUEL_CC_TO_SEGMENT",
  "VEHICLE_TO_TYPE",
  "CUSTOM",
]);

export const mappingRuleSchema = z
  .object({
    mappingId: z.string().min(1),
    insurer: insurerCodeSchema,
    mappingType: mappingTypeSchema,
    input: z.record(z.string(), jsonValueSchema),
    output: jsonValueSchema,
    conditions: z
      .array(
        z
          .object({
            dimension: z.string().min(1),
            operator: z.enum(["EQ", "IN", "RANGE", "EXISTS"]),
            value: jsonValueSchema.optional(),
          })
          .strict(),
      )
      .default([]),
    sourceEvidence: z.array(evidenceReferenceSchema).min(1),
    notes: z.string().optional(),
  })
  .strict();

export const conditionOperatorSchema = z.enum([
  "EQ",
  "NEQ",
  "IN",
  "NOT_IN",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "BETWEEN",
  "ALL",
  "EXISTS",
  "CONTAINS",
]);

export const ruleConditionSchema = z
  .object({
    /** Examples: fuel, rtoCluster, vehicleSegment, engineCC, ncbPercent, gwp. */
    dimension: z.string().min(1),
    operator: conditionOperatorSchema,
    value: jsonValueSchema.optional(),
    lowerInclusive: z.boolean().optional(),
    upperInclusive: z.boolean().optional(),
    unit: z.string().optional(),
  })
  .superRefine((condition, context) => {
    if (
      !["ALL", "EXISTS"].includes(condition.operator) &&
      condition.value === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${condition.operator} requires a value.`,
      });
    }
    if (
      condition.operator === "BETWEEN" &&
      (condition.lowerInclusive === undefined ||
        condition.upperInclusive === undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "BETWEEN requires explicit boundary inclusivity.",
      });
    }
  });

export const rulePriorityTierSchema = z.enum([
  "POLICY_SPECIFIC",
  "FLEET_CODE",
  "PAN_SPECIFIC",
  "CODE_SPECIFIC",
  "SPECIAL_DEAL",
  "SPECIFIC_SUB_SEGMENT",
  "STANDARD_GRID",
  "CUSTOM",
]);

const baseRateEffectSchema = z
  .object({
    kind: z.literal("BASE_RATE"),
    ratePercent: decimalStringSchema,
    rateScope: z.enum(["OD", "TP", "PACKAGE"]),
    premiumBasis: z.enum([
      "OD_NET_PREMIUM",
      "TP_NET_PREMIUM",
      "TOTAL_NET_PACKAGE_PREMIUM",
      "NET_PREMIUM",
      "GWP",
      "UNKNOWN",
    ]),
    allInclusive: z.boolean().nullable(),
  })
  .strict();

const rawMetricEffectSchema = z
  .object({
    kind: z.literal("RAW_METRIC"),
    rawLabel: z.string().min(1),
    rawValue: decimalStringSchema,
    displayUnit: z.enum([
      "PERCENT_FORMATTED",
      "DECIMAL_FRACTION",
      "AMOUNT",
      "UNKNOWN",
    ]),
    meaningStatus: z.enum(["VERIFIED", "UNRESOLVED"]),
    eligibleForCommissionOutput: z.literal(false),
  })
  .strict();

const relativeAdjustmentEffectSchema = z
  .object({
    kind: z.literal("RELATIVE_ADJUSTMENT"),
    operation: z.literal("MULTIPLY_RATE"),
    factor: decimalStringSchema,
    description: z.string().min(1),
  })
  .strict();

const declineEffectSchema = z
  .object({
    kind: z.literal("DECLINE"),
    reasonCode: z.string().min(1),
    description: z.string().min(1),
    declineScope: z.enum(["RULE", "RTO", "CLUSTER", "POLICY"]),
  })
  .strict();

const exclusionEffectSchema = z
  .object({
    kind: z.literal("EXCLUSION"),
    reasonCode: z.string().min(1),
    description: z.string().min(1),
    appliesTo: z.enum(["OD", "TP", "PACKAGE", "POLICY"]),
  })
  .strict();

const percentagePointAdjustmentEffectSchema = z
  .object({
    kind: z.literal("PERCENTAGE_POINT_ADJUSTMENT"),
    operation: z.enum(["ADD_PERCENTAGE_POINTS", "SUBTRACT_PERCENTAGE_POINTS"]),
    value: decimalStringSchema,
    description: z.string().min(1),
  })
  .strict();

const fixedAmountAdjustmentEffectSchema = z
  .object({
    kind: z.literal("FIXED_AMOUNT_ADJUSTMENT"),
    operation: z.enum(["ADD_FIXED_AMOUNT", "SUBTRACT_FIXED_AMOUNT"]),
    amount: z
      .object({
        amount: decimalStringSchema,
        currency: z.literal("INR"),
      })
      .strict(),
    description: z.string().min(1),
  })
  .strict();

const unresolvedAdjustmentEffectSchema = z
  .object({
    kind: z.literal("UNRESOLVED_ADJUSTMENT"),
    reasonCode: z.enum([
      "OPERATION_UNDEFINED",
      "CONDITION_UNVERIFIED",
      "VALUE_MISSING",
      "SOURCE_CONFLICT",
    ]),
    description: z.string().min(1),
  })
  .strict();

const incrementalCoaEffectSchema = z
  .object({
    kind: z.literal("INCREMENTAL_COA"),
    valueType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    value: decimalStringSchema,
    basis: z.enum(["NET_PREMIUM", "GWP", "FIXED", "UNKNOWN"]),
    eligibilityRequiresGwpSlab: z.boolean(),
    sourceMeaningStatus: z.enum(["VERIFIED", "UNRESOLVED"]),
    producerGwp: z
      .object({
        amount: decimalStringSchema,
        currency: z.literal("INR"),
      })
      .nullable(),
    applicableSlab: z.string().min(1).nullable(),
    lowerThreshold: decimalStringSchema.nullable(),
    upperThreshold: decimalStringSchema.nullable(),
    thresholdInclusive: z
      .object({
        lower: z.boolean(),
        upper: z.boolean(),
      })
      .nullable(),
    allInclusive: z.boolean().nullable(),
    eligible: z.boolean(),
    evidence: z.array(evidenceReferenceSchema),
  })
  .strict();

export const ruleEffectSchema = z.discriminatedUnion("kind", [
  baseRateEffectSchema,
  rawMetricEffectSchema,
  relativeAdjustmentEffectSchema,
  declineEffectSchema,
  exclusionEffectSchema,
  percentagePointAdjustmentEffectSchema,
  fixedAmountAdjustmentEffectSchema,
  unresolvedAdjustmentEffectSchema,
  incrementalCoaEffectSchema,
]);

export const lookupBasisSchema = z
  .object({
    kind: z.enum([
      "POLICY_FIELD",
      "PREMIUM_SLAB",
      "AGGREGATED_GWP",
      "CUSTOM",
      "NONE",
    ]),
    description: z.string().optional(),
    includedComponents: z.array(z.string()),
    excludedComponents: z.array(z.string()),
  })
  .strict();

export const ruleMatchOutcomeSchema = z.enum([
  "MATCHED",
  "DECLINED",
  "EXCLUDED",
  "OVERRIDDEN",
  "MISSING_DATA",
]);

export const overrideHierarchySchema = z.enum([
  "POLICY_SPECIFIC",
  "FLEET_CODE",
  "PAN_SPECIFIC",
  "CODE_SPECIFIC",
  "SPECIAL_DEAL",
  "SPECIFIC_SUB_SEGMENT",
  "STANDARD_GRID",
  "UNMAPPED",
]);

export const ruleSpecificitySchema = z.enum([
  "HIGH_PRIORITY_OVERRIDE",
  "SPECIFIC_SUB_SEGMENT",
  "STANDARD_GRID",
  "UNSPECIFIED",
]);

export const commissionRuleSchema = z
  .object({
    ruleId: z.string().min(1),
    insurer: insurerCodeSchema,
    productScope: z.string().min(1),
    ruleCategory: z.enum([
      "BASE",
      "ADJUSTMENT",
      "INCREMENTAL",
      "RAW_OBSERVATION",
      "DECLINE",
      "EXCLUSION",
      "UNRESOLVED",
    ]),
    conditions: z.array(ruleConditionSchema),
    matchOutcome: ruleMatchOutcomeSchema.optional(),
    /** Lookup/slab basis is deliberately separate from the payout premium basis. */
    lookupBasis: lookupBasisSchema.optional(),
    effect: ruleEffectSchema,
    priority: z
      .object({
        tier: rulePriorityTierSchema,
        rank: z.number().int().positive(),
        sourceLabel: z.string().optional(),
        overrideHierarchy: overrideHierarchySchema.optional(),
        ruleSpecificity: ruleSpecificitySchema.optional(),
        matchOutcome: ruleMatchOutcomeSchema.optional(),
      })
      .strict(),
    sourceEvidence: z.array(evidenceReferenceSchema).min(1),
    notes: z.string().optional(),
  })
  .strict();

export const ruleBundleSchema = z
  .object({
    bundleId: z.string().min(1),
    bundleVersion: z.string().min(1),
    insurer: insurerCodeSchema,
    createdAt: z.string().datetime({ offset: true }),
    sources: z.array(gridSourceSchema).min(1),
    mappings: z.array(mappingRuleSchema),
    commissionRules: z.array(commissionRuleSchema),
    dateSelection: z
      .object({
        anchor: gridDateAnchorSchema,
        fallbackAllowed: z.literal(false),
        notes: z.string().optional(),
      })
      .strict(),
    overridePrecedence: z
      .object({
        enabled: z.boolean(),
        orderedTiers: z.array(rulePriorityTierSchema),
        overrideHierarchy: z.array(overrideHierarchySchema).optional(),
        ruleSpecificity: z.array(ruleSpecificitySchema).optional(),
        unresolvedLabels: z.array(z.string()),
        sourceEvidence: z.array(evidenceReferenceSchema),
      })
      .strict(),
  })
  .strict();

export type GridSource = z.infer<typeof gridSourceSchema>;
export type MappingRule = z.infer<typeof mappingRuleSchema>;
export type RuleCondition = z.infer<typeof ruleConditionSchema>;
export type CommissionRule = z.infer<typeof commissionRuleSchema>;
export type LookupBasis = z.infer<typeof lookupBasisSchema>;
export type RuleBundle = z.infer<typeof ruleBundleSchema>;
export type GridSelectionResult = z.infer<typeof gridSelectionResultSchema>;
