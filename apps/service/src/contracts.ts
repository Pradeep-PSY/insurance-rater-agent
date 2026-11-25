import { z } from "zod";

export const processingStatusSchema = z.enum([
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

export const decisionStatusSchema = z.enum(["RESOLVED", "UNSUPPORTED", "AMBIGUOUS"]);

export const evidenceSchema = z.object({
  sourceKind: z.enum(["POLICY_PDF", "COMMISSION_GRID_PDF", "COMMISSION_GRID_XLSX", "OWNER_CLARIFICATION", "EXTERNAL_REFERENCE", "SYSTEM_DERIVATION"]),
  fileName: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  pageNumber: z.number().int().positive().nullable(),
  sheetName: z.string().min(1).nullable(),
  cellRange: z.string().min(1).nullable(),
  quote: z.string().nullable(),
  validation: z.enum(["VERIFIED", "REJECTED", "NOT_APPLICABLE"]),
  ocrConfidence: z.number().min(0).max(1).nullable(),
  extraction: z.object({
    method: z.enum(["PDF_TEXT", "OCR", "NOT_APPLICABLE"]),
    providerId: z.string().nullable(),
    version: z.string().nullable(),
  }).strict(),
  geometry: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    pageWidth: z.number().positive(),
    pageHeight: z.number().positive(),
  }).strict().nullable(),
}).strict().superRefine((evidence, ctx) => {
  if (evidence.sourceKind === "POLICY_PDF" && evidence.validation === "VERIFIED" &&
      (!evidence.pageNumber || evidence.quote === null || evidence.extraction.method === "NOT_APPLICABLE")) {
    ctx.addIssue({ code: "custom", message: "Verified policy PDF evidence requires page, quote, and extraction provenance." });
  }
  if (evidence.sourceKind !== "POLICY_PDF" &&
      (evidence.extraction.method !== "NOT_APPLICABLE" || evidence.ocrConfidence !== null)) {
    ctx.addIssue({ code: "custom", message: "Non-policy evidence cannot claim PDF extraction or OCR provenance." });
  }
  if (evidence.extraction.method === "OCR" && !evidence.extraction.providerId) {
    ctx.addIssue({ code: "custom", message: "OCR evidence requires a provider identifier." });
  }
});

export const factSchema = z.object({
  field: z.string().min(1),
  status: z.enum(["KNOWN", "MISSING", "INVALID", "AMBIGUOUS", "UNVERIFIED"]),
  rawValue: z.string().nullable(),
  normalizedValue: z.string().nullable(),
  provenance: z.enum(["POLICY_DOCUMENT", "EXTERNAL_REFERENCE", "OWNER_CLARIFICATION", "DERIVED", "SYSTEM"]),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW", "NOT_ASSESSED"]),
  evidence: z.array(evidenceSchema),
  confidenceReason: z.string().min(1),
}).strict().superRefine((fact, ctx) => {
  if (fact.status === "KNOWN" && (!fact.normalizedValue || fact.evidence.length === 0 ||
      fact.evidence.some((item) =>
        item.validation === "REJECTED" ||
        (item.sourceKind === "POLICY_PDF" && item.validation !== "VERIFIED") ||
        (item.sourceKind !== "POLICY_PDF" && item.validation !== "NOT_APPLICABLE")))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "KNOWN facts require a normalized value and evidence." });
  }
  if (fact.status === "INVALID" && (!fact.rawValue || fact.evidence.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "INVALID facts require the preserved raw value and evidence." });
  }
  if (fact.status === "AMBIGUOUS" && fact.evidence.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "AMBIGUOUS facts require at least two evidence references." });
  }
  if (fact.status === "AMBIGUOUS" && fact.evidence.filter((item) => item.validation !== "REJECTED").length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "AMBIGUOUS facts require at least two validated evidence references." });
  }
  if (fact.status === "MISSING" && fact.normalizedValue !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MISSING facts cannot have a normalized value." });
  }
});

export const gridSelectionSchema = z.object({
  insurer: z.string().nullable(),
  dateAnchorKind: z.enum(["POLICY_ISSUE_DATE", "INSURER_LOGIN_DATE", "UNRESOLVED"]),
  resolvedAnchorDate: z.string().date().nullable(),
  selectedBundle: z.object({
    id: z.string().min(1),
    version: z.string().min(1),
    sourceFile: z.string().min(1),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict().nullable(),
  effectivePeriod: z.object({
    from: z.string().date().nullable(),
    to: z.string().date().nullable(),
  }).strict().nullable(),
  coverageStatus: z.enum(["COVERED", "NO_APPLICABLE_VERSION", "UNRESOLVED", "NOT_ATTEMPTED"]),
  dateAnchorEvidence: z.array(evidenceSchema),
  selectionEvidence: z.array(evidenceSchema),
  reasonCode: z.enum(["SELECTED", "NOT_COVERED_FROM_AVAILABLE_EVIDENCE", "ANCHOR_DATE_MISSING", "ANCHOR_DATE_CONFLICT", "INSURER_UNKNOWN", "NO_APPROVED_RULESET"]),
  reason: z.string().min(1),
}).strict().superRefine((selection, ctx) => {
  if (selection.coverageStatus === "COVERED") {
    if (!selection.selectedBundle || !selection.resolvedAnchorDate || !selection.effectivePeriod ||
        !selection.effectivePeriod.from || !selection.selectionEvidence.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "COVERED selection requires a bundle, anchor date, effective start, and evidence." });
    }
    if (selection.dateAnchorKind === "UNRESOLVED") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "COVERED selection requires a documented date anchor kind." });
    }
    if (!selection.dateAnchorEvidence.length || !selection.resolvedAnchorDate ||
        !selection.effectivePeriod?.from ||
        selection.resolvedAnchorDate < selection.effectivePeriod.from ||
        (selection.effectivePeriod.to !== null && selection.resolvedAnchorDate > selection.effectivePeriod.to)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selected grid effective period must cover the evidence-backed anchor date." });
    }
  } else if (selection.selectedBundle !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Uncovered or unresolved selection cannot contain a selected bundle." });
  }
  if (selection.coverageStatus === "NO_APPLICABLE_VERSION" &&
      selection.reasonCode !== "NOT_COVERED_FROM_AVAILABLE_EVIDENCE") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "No applicable version requires an explicit not-covered reason code." });
  }
  if (selection.effectivePeriod?.from && selection.effectivePeriod.to &&
      selection.effectivePeriod.to < selection.effectivePeriod.from) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Grid effective period end cannot precede its start." });
  }
});

export const componentResultSchema = z.object({
  component: z.enum(["OD", "TP", "PACKAGE"]),
  applicability: z.enum(["APPLICABLE", "NOT_APPLICABLE", "NOT_SEPARATELY_SPECIFIED", "UNRESOLVED"]),
  status: z.enum(["RESOLVED", "UNSUPPORTED", "AMBIGUOUS", "WITHHELD", "NOT_APPLICABLE", "NOT_SEPARATELY_SPECIFIED"]),
  ratePercent: z.string().regex(/^\d+(?:\.\d+)?$/).nullable(),
  candidateRatePercent: z.string().regex(/^\d+(?:\.\d+)?$/).nullable(),
  premiumBasis: z.string().nullable(),
  evidence: z.array(evidenceSchema),
  reason: z.string().min(1),
}).strict().superRefine((component, ctx) => {
  if (component.status === "NOT_APPLICABLE" &&
      (component.applicability !== "NOT_APPLICABLE" || component.ratePercent !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not-applicable components cannot carry a percentage rate." });
  }
  if (component.status === "NOT_SEPARATELY_SPECIFIED" &&
      (component.applicability !== "NOT_SEPARATELY_SPECIFIED" || component.ratePercent !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not-separately-specified components cannot carry a percentage rate." });
  }
});

export const traceStepSchema = z.object({
  sequence: z.number().int().positive(),
  stage: z.string().min(1),
  status: z.enum(["COMPLETED", "SKIPPED", "BLOCKED", "WARNING"]),
  summary: z.string().min(1),
  evidence: z.array(evidenceSchema),
}).strict();

export const issueSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  blocking: z.boolean(),
  evidence: z.array(evidenceSchema),
}).strict();

const payoutInputSchema = z.object({
  name: z.string().min(1),
  value: z.string().nullable(),
  unit: z.enum(["INR", "PERCENT", "TEXT"]),
  evidence: z.array(evidenceSchema),
}).strict();

const moneyStageSchema = z.object({
  status: z.enum(["CALCULATED", "NOT_CALCULATED", "AMBIGUOUS", "NOT_APPLICABLE"]),
  formula: z.enum([
    "PREMIUM_TIMES_RATE",
    "ELIGIBLE_INCREMENT",
    "BASE_PLUS_INCREMENT",
    "SIGNED_ADJUSTMENT",
    "GROSS_PLUS_SIGNED_ADJUSTMENTS",
    "UNRESOLVED",
  ]),
  premiumBasis: z.enum(["OD_NET_PREMIUM", "TP_NET_PREMIUM", "PACKAGE_NET_PREMIUM", "UNRESOLVED"]).nullable(),
  inputs: z.array(payoutInputSchema),
  outputInr: z.string().regex(/^-?\d+(?:\.\d+)?$/).nullable(),
  reason: z.string().min(1),
  evidence: z.array(evidenceSchema),
}).strict().superRefine((stage, ctx) => {
  if (stage.status === "CALCULATED" && (stage.outputInr === null || stage.formula === "UNRESOLVED")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Calculated payout stages require a defined formula and output." });
  }
  if (stage.status === "NOT_CALCULATED" && stage.outputInr !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Uncalculated payout stages cannot have an output amount." });
  }
});

export const payoutStagesSchema = z.object({
  baseCommission: moneyStageSchema,
  incrementalCoa: moneyStageSchema,
  grossPayout: moneyStageSchema,
  settlementAdjustments: z.array(moneyStageSchema),
  netPayable: moneyStageSchema,
}).strict().superRefine((payout, ctx) => {
  const requiredCoaInputs = ["producerGwp", "applicableSlab", "threshold", "increment", "basis", "allInclusiveStatus", "eligibility"];
  const coaInputs = new Set(payout.incrementalCoa.inputs.map((input) => input.name));
  for (const requiredInput of requiredCoaInputs) {
    if (!coaInputs.has(requiredInput)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Incremental COA must preserve ${requiredInput}.` });
    }
  }
  if (payout.baseCommission.status === "CALCULATED" &&
      (payout.baseCommission.formula !== "PREMIUM_TIMES_RATE" ||
       payout.baseCommission.premiumBasis === null ||
       payout.baseCommission.premiumBasis === "UNRESOLVED")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Calculated base commission requires a defined formula and premium basis." });
  }
});

export const ruleMatchResultSchema = z.object({
  ruleId: z.string().min(1),
  outcome: z.enum(["MATCHED", "DECLINED", "EXCLUDED", "OVERRIDDEN", "MISSING_DATA", "NOT_APPLICABLE"]),
  matchedConditions: z.array(z.string()),
  missingConditions: z.array(z.string()),
  priorityDimensions: z.object({
    overrideHierarchy: z.string().nullable(),
    ruleSpecificity: z.string().nullable(),
  }).strict(),
  evidence: z.array(evidenceSchema),
}).strict();

export const rateAdjustmentSchema = z.object({
  ruleId: z.string().min(1),
  operation: z.enum(["MULTIPLY_RATE", "ADD_PERCENTAGE_POINTS", "ADD_FIXED_AMOUNT"]),
  operand: z.string().regex(/^\d+(?:\.\d+)?$/),
  status: z.enum(["APPLIED", "NOT_APPLIED", "UNRESOLVED"]),
  evidence: z.array(evidenceSchema),
  reason: z.string().min(1),
}).strict().superRefine((adjustment, ctx) => {
  if (adjustment.status === "APPLIED" && adjustment.evidence.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Applied rate adjustments require source evidence." });
  }
});

export const analysisResultSchema = z.object({
  runId: z.string().uuid(),
  documentId: z.string().uuid(),
  processingStatus: processingStatusSchema,
  decisionStatus: decisionStatusSchema,
  selectedRuleset: z.object({
    id: z.string().nullable(),
    version: z.string().nullable(),
    status: z.enum(["SELECTED", "NOT_SELECTED"]),
  }).strict(),
  facts: z.array(factSchema),
  components: z.array(componentResultSchema).length(3),
  ruleMatches: z.array(ruleMatchResultSchema),
  rateAdjustments: z.array(rateAdjustmentSchema),
  gridSelection: gridSelectionSchema,
  payoutStages: payoutStagesSchema,
  uninterpretedMetrics: z.array(z.object({
    fieldName: z.string().min(1),
    rawValue: z.string().nullable(),
    interpretationStatus: z.literal("UNINTERPRETED"),
    evidence: z.array(evidenceSchema),
  }).strict()),
  trace: z.array(traceStepSchema),
  confidence: z.object({
    level: z.enum(["HIGH", "MEDIUM", "LOW", "NOT_ASSESSED"]),
    reasons: z.array(z.string()),
  }).strict(),
  unresolvedIssues: z.array(issueSchema),
  versions: z.object({
    parser: z.string(),
    extractor: z.string().nullable(),
    ocr: z.object({
      providerId: z.string(),
      version: z.string().nullable(),
      status: z.enum(["NOT_REQUIRED", "NOT_CONFIGURED", "PROVIDED"]),
    }).strict(),
    resolver: z.string(),
  }).strict(),
}).strict().superRefine((result, ctx) => {
  const componentNames = new Set(result.components.map((component) => component.component));
  if (componentNames.size !== 3) {
    ctx.addIssue({ code: "custom", message: "Exactly one OD, TP, and PACKAGE result is required." });
  }
  if (result.gridSelection.coverageStatus === "COVERED") {
    if (result.selectedRuleset.status !== "SELECTED" ||
        result.selectedRuleset.id !== result.gridSelection.selectedBundle?.id) {
      ctx.addIssue({ code: "custom", message: "Selected ruleset must match the covered grid-selection bundle." });
    }
  } else if (result.selectedRuleset.status !== "NOT_SELECTED") {
    ctx.addIssue({ code: "custom", message: "An uncovered grid selection cannot select a ruleset." });
  }
  if (result.decisionStatus === "RESOLVED" &&
      (result.gridSelection.coverageStatus !== "COVERED" ||
       result.components.some((component) => component.status === "UNSUPPORTED" || component.status === "AMBIGUOUS" || component.status === "WITHHELD"))) {
    ctx.addIssue({ code: "custom", message: "A resolved decision requires covered grid selection and no unresolved requested component." });
  }
});

export const runSummarySchema = z.object({
  id: z.string().uuid(),
  originalFilename: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteSize: z.number().int().positive(),
  pageCount: z.number().int().positive(),
  processingStatus: processingStatusSchema,
  decisionStatus: decisionStatusSchema.nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type FactRecord = z.infer<typeof factSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
