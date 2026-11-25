import { z } from "zod";

const sourceIdentitySchema = z.object({
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
}).passthrough();

const hdfcSchema = z.object({
  sourceIdentity: sourceIdentitySchema,
  sampleResolutionTrace: z.object({
    decisionStatus: z.enum(["RESOLVED", "UNSUPPORTED", "AMBIGUOUS"]),
    reasonCode: z.string(),
    selectedGridEffectiveFrom: z.string().nullable(),
    anchorDate: z.string().nullable(),
    componentApplicability: z.object({ od: z.string(), tp: z.string() }).passthrough(),
    conditionalCandidates: z.array(z.object({
      ratePercent: z.string(),
      source: z.object({
        pageNumber: z.number().int().positive(),
        itemIndex: z.number().int().nonnegative(),
        locator: z.string(),
      }).passthrough(),
    }).passthrough()),
    finalRatePercent: z.null(),
    finalPayoutAmount: z.null(),
    withheldReason: z.string(),
  }).passthrough(),
}).passthrough();

const goDigitSchema = z.object({
  sourceIdentity: sourceIdentitySchema,
  sampleResolutionTrace: z.object({
    status: z.enum(["RESOLVED", "UNSUPPORTED", "AMBIGUOUS"]),
    reasonCode: z.string(),
    odApplicability: z.literal("NOT_APPLICABLE"),
    rtoMapping: z.object({ sourceRanges: z.array(z.string()) }).passthrough(),
    candidateRows: z.array(z.object({ sourceRow: z.number().int().positive(), sourceRange: z.string() }).passthrough()),
    rawMetric: z.object({
      fieldName: z.string(),
      rawValue: z.union([z.string(), z.number()]).nullable(),
      semanticStatus: z.string(),
      eligibleForCommissionOutput: z.boolean(),
      source: z.object({ sheet: z.string(), cell: z.string() }).passthrough(),
    }).passthrough(),
    tpCommissionRate: z.null(),
  }).passthrough(),
}).passthrough();

const relianceSchema = z.object({
  sourceIdentity: sourceIdentitySchema,
  sampleResolutionTrace: z.object({
    status: z.enum(["RESOLVED", "UNSUPPORTED", "AMBIGUOUS"]),
    reasonCode: z.string(),
    policyIssueDate: z.object({ normalizedValue: z.string().nullable(), status: z.string() }).passthrough(),
    dateAnchor: z.object({ kind: z.string(), resolvedDate: z.string().nullable() }).passthrough(),
    gridApplicability: z.string(),
    latestGridFallbackUsed: z.boolean(),
    finalCommissionRate: z.null(),
    finalPayoutAmount: z.null(),
    candidate: z.object({ sourceRow: z.number().int().positive(), sourceRange: z.string() }).passthrough(),
  }).passthrough(),
}).passthrough();

const tataSchema = z.object({
  sourceIdentity: sourceIdentitySchema,
  sampleResolutionTrace: z.object({
    policyClass: z.string(),
    sampleContext: z.object({
      policyIssueDateStatus: z.string(),
      insurerDefinedLoginDateStatus: z.string(),
    }).passthrough(),
    baseCandidateStatus: z.string(),
    candidateTypes: z.array(z.object({
      sourceRow: z.number().int().positive(),
      rate: z.object({ displayedPercent: z.string() }).passthrough(),
      rowEvidence: z.array(z.object({
        source: z.object({ sheet: z.string(), cell: z.string() }).passthrough(),
      }).passthrough()),
    }).passthrough()),
    baseRateCandidate: z.object({
      displayedPercent: z.string(),
      basis: z.string(),
      approvedFinalRate: z.literal(false),
      basisEvidence: z.array(z.object({
        sourceKind: z.string(),
        file: z.string(),
        sheet: z.string().nullable(),
        cell: z.string().nullable(),
      }).passthrough()),
    }).passthrough(),
    odApplicability: z.literal("NOT_APPLICABLE"),
    allInPayoutStatus: z.string(),
    stages: z.array(z.object({ stage: z.string(), status: z.string(), reason: z.string() }).passthrough()),
  }).passthrough(),
}).passthrough();

const citationSchema = z.object({
  sourceKind: z.string(),
  file: z.string(),
  page: z.number().int().positive().nullable(),
  sheet: z.string().nullable(),
  cellRange: z.string().nullable(),
  locator: z.string().nullable(),
}).strict();

const componentSchema = z.object({
  component: z.enum(["OD", "TP", "PACKAGE"]),
  applicability: z.enum(["APPLICABLE", "NOT_APPLICABLE", "NOT_SEPARATELY_SPECIFIED", "UNRESOLVED"]),
  status: z.enum(["NOT_APPLICABLE", "NOT_SEPARATELY_SPECIFIED", "WITHHELD", "UNSUPPORTED"]),
  finalRatePercent: z.null(),
  candidateRatePercent: z.string().nullable(),
  evidence: z.array(citationSchema),
  reason: z.string(),
}).strict();

export const draftSampleTraceSchema = z.object({
  insurer: z.enum(["HDFC_ERGO", "GO_DIGIT", "RELIANCE_INDUSIND", "TATA_AIG"]),
  adapterStatus: z.literal("DRAFT_NOT_APPROVED"),
  decisionStatus: z.enum(["UNSUPPORTED", "AMBIGUOUS"]),
  reasonCode: z.string(),
  sourceFile: z.string(),
  sourcePath: z.string(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  gridSelection: z.object({
    status: z.enum(["AVAILABLE_SOURCE_VERSION", "NO_APPLICABLE_VERSION", "UNRESOLVED"]),
    anchorKind: z.string(),
    anchorDate: z.string().nullable(),
    effectiveFrom: z.string().nullable(),
    latestGridFallbackUsed: z.literal(false),
    reason: z.string(),
    evidence: z.array(citationSchema),
  }).strict(),
  components: z.array(componentSchema).length(3),
  uninterpretedMetrics: z.array(z.object({
    fieldName: z.string(),
    rawValue: z.string(),
    evidence: z.array(citationSchema),
  }).strict()),
  rateAdjustments: z.array(z.object({
    ruleId: z.string(),
    operation: z.enum(["MULTIPLY_RATE", "ADD_PERCENTAGE_POINTS", "ADD_FIXED_AMOUNT"]),
    operand: z.string(),
    status: z.enum(["APPLIED", "NOT_APPLIED", "UNRESOLVED"]),
    reason: z.string(),
    evidence: z.array(citationSchema),
  }).strict()),
  payoutStages: z.array(z.object({
    stage: z.string(),
    status: z.enum(["NOT_CALCULATED", "PENDING", "NOT_APPLICABLE"]),
    reason: z.string(),
    evidence: z.array(citationSchema),
  }).strict()),
  trace: z.array(z.object({
    sequence: z.number().int().positive(),
    stage: z.string(),
    status: z.enum(["COMPLETED", "BLOCKED", "WARNING"]),
    summary: z.string(),
    evidence: z.array(citationSchema),
  }).strict()),
  sourceReport: z.string(),
}).strict();

export type DraftSampleTrace = z.infer<typeof draftSampleTraceSchema>;

function citation(input: {
  sourceKind: string;
  file: string;
  page?: number | null;
  sheet?: string | null;
  cell?: string | null;
  cellRange?: string | null;
  locator?: string | null;
}): z.infer<typeof citationSchema> {
  return citationSchema.parse({
    sourceKind: input.sourceKind,
    file: input.file,
    page: input.page ?? null,
    sheet: input.sheet ?? null,
    cellRange: input.cellRange ?? input.cell ?? null,
    locator: input.locator ?? null,
  });
}

function components(input: {
  od: z.infer<typeof componentSchema>;
  tp: z.infer<typeof componentSchema>;
  package: z.infer<typeof componentSchema>;
}): DraftSampleTrace["components"] {
  return [input.od, input.tp, input.package];
}

export function bridgeHdfcDraft(input: unknown): DraftSampleTrace {
  const draft = hdfcSchema.parse(input);
  const trace = draft.sampleResolutionTrace;
  const source = draft.sourceIdentity;
  const candidateEvidence = trace.conditionalCandidates.map((candidate) =>
    citation({
      sourceKind: "COMMISSION_GRID_PDF",
      file: source.fileName,
      page: candidate.source.pageNumber,
      locator: candidate.source.locator,
    }),
  );
  const gridEvidence = trace.selectedGridEffectiveFrom
    ? [citation({
        sourceKind: "COMMISSION_GRID_PDF",
        file: source.fileName,
        page: 1,
        locator: "printed effective-from text item",
      })]
    : [];
  return draftSampleTraceSchema.parse({
    insurer: "HDFC_ERGO",
    adapterStatus: "DRAFT_NOT_APPROVED",
    decisionStatus: trace.decisionStatus,
    reasonCode: trace.reasonCode,
    sourceFile: source.fileName,
    sourcePath: source.relativePath,
    sourceSha256: source.sha256,
    gridSelection: {
      status: trace.selectedGridEffectiveFrom ? "AVAILABLE_SOURCE_VERSION" : "UNRESOLVED",
      anchorKind: "POLICY_ISSUE_DATE",
      anchorDate: trace.anchorDate,
      effectiveFrom: trace.selectedGridEffectiveFrom,
      latestGridFallbackUsed: false,
      reason: "The printed effective-from date is cited; no later grid fallback is performed. Candidate table values remain conditional.",
      evidence: gridEvidence,
    },
    components: components({
      od: {
        component: "OD",
        applicability: "NOT_SEPARATELY_SPECIFIED",
        status: "NOT_SEPARATELY_SPECIFIED",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence: candidateEvidence,
        reason: "The selected table publishes a Package rate, not a separate OD rate.",
      },
      tp: {
        component: "TP",
        applicability: "NOT_SEPARATELY_SPECIFIED",
        status: "NOT_SEPARATELY_SPECIFIED",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence: candidateEvidence,
        reason: "The Package rate is applied once to total eligible net package premium; no separate TP rate is generated.",
      },
      package: {
        component: "PACKAGE",
        applicability: "APPLICABLE",
        status: "WITHHELD",
        finalRatePercent: null,
        candidateRatePercent: trace.conditionalCandidates[0]?.ratePercent ?? null,
        evidence: candidateEvidence,
        reason: trace.withheldReason,
      },
    }),
    uninterpretedMetrics: [],
    rateAdjustments: [],
    payoutStages: [{
      stage: "PACKAGE_BASE_COMMISSION",
      status: "NOT_CALCULATED",
      reason: "Fuel provenance is unresolved; final rate and payout remain withheld. Package basis excludes GST.",
      evidence: candidateEvidence,
    }],
    trace: [
      { sequence: 1, stage: "GRID_VERSION", status: "COMPLETED", summary: `Supplied grid states effective from ${trace.selectedGridEffectiveFrom ?? "an unknown date"}.`, evidence: gridEvidence },
      { sequence: 2, stage: "POLICY_FACTS", status: "BLOCKED", summary: trace.withheldReason, evidence: [] },
      { sequence: 3, stage: "RATE_MATCH", status: "BLOCKED", summary: "Fuel is required to select the Petrol/Non-Petrol column; conditional candidates are not final rates.", evidence: candidateEvidence },
      { sequence: 4, stage: "PAYOUT", status: "BLOCKED", summary: "No final commission rate or payout is calculated.", evidence: candidateEvidence },
    ],
    sourceReport: "phase-2b-hdfc/artifacts/hdfc-ergo/HDFC-ERGO-ADAPTER-REPORT.md",
  });
}

export function bridgeGoDigitDraft(input: unknown): DraftSampleTrace {
  const draft = goDigitSchema.parse(input);
  const trace = draft.sampleResolutionTrace;
  const source = draft.sourceIdentity;
  const metricCitation = citation({
    sourceKind: "COMMISSION_GRID_XLSX",
    file: source.fileName,
    sheet: trace.rawMetric.source.sheet,
    cell: trace.rawMetric.source.cell,
  });
  const candidateEvidence = trace.candidateRows.map((row) => citation({
    sourceKind: "COMMISSION_GRID_XLSX",
    file: source.fileName,
    sheet: "4W SATP",
    cellRange: row.sourceRange,
  }));
  const mappingEvidence = trace.rtoMapping.sourceRanges.map((range) => citation({
    sourceKind: "COMMISSION_GRID_XLSX",
    file: source.fileName,
    sheet: "4W  RTO",
    cellRange: range,
  }));
  return draftSampleTraceSchema.parse({
    insurer: "GO_DIGIT",
    adapterStatus: "DRAFT_NOT_APPROVED",
    decisionStatus: trace.status,
    reasonCode: trace.reasonCode,
    sourceFile: source.fileName,
    sourcePath: source.relativePath,
    sourceSha256: source.sha256,
    gridSelection: {
      status: "UNRESOLVED",
      anchorKind: "POLICY_ISSUE_DATE",
      anchorDate: null,
      effectiveFrom: null,
      latestGridFallbackUsed: false,
      reason: "Effective date bounds are unknown; the filename period is not used as an effective date.",
      evidence: [],
    },
    components: components({
      od: {
        component: "OD",
        applicability: "NOT_APPLICABLE",
        status: "NOT_APPLICABLE",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence: [],
        reason: "The sample is stand-alone TP.",
      },
      tp: {
        component: "TP",
        applicability: "APPLICABLE",
        status: "WITHHELD",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence: [...mappingEvidence, ...candidateEvidence, metricCitation],
        reason: "Max CD2 is an uninterpreted source metric, not an approved commission percentage.",
      },
      package: {
        component: "PACKAGE",
        applicability: "NOT_APPLICABLE",
        status: "NOT_APPLICABLE",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence: [],
        reason: "The sample is stand-alone TP.",
      },
    }),
    uninterpretedMetrics: [{
      fieldName: trace.rawMetric.fieldName,
      rawValue: String(trace.rawMetric.rawValue),
      evidence: [metricCitation],
    }],
    rateAdjustments: [],
    payoutStages: [{
      stage: "TP_COMMISSION",
      status: "NOT_CALCULATED",
      reason: "Source field semantics are unresolved; no TP commission is emitted.",
      evidence: [metricCitation, ...candidateEvidence],
    }],
    trace: [
      { sequence: 1, stage: "GRID_VERSION", status: "BLOCKED", summary: "Effective date bounds are unknown; no current version can be selected.", evidence: [] },
      { sequence: 2, stage: "RTO_AND_ROW_MATCH", status: "COMPLETED", summary: "The adapter draft records the SATP RTO mapping and row candidate.", evidence: [...mappingEvidence, ...candidateEvidence] },
      { sequence: 3, stage: "FIELD_SEMANTICS", status: "BLOCKED", summary: `${trace.rawMetric.fieldName} is preserved raw and is not eligible for commission output.`, evidence: [metricCitation] },
      { sequence: 4, stage: "RATE_RESOLUTION", status: "BLOCKED", summary: "TP commission remains withheld; OD is not applicable.", evidence: [...mappingEvidence, metricCitation, ...candidateEvidence] },
    ],
    sourceReport: "phase-2b/artifacts/godigit-satp/GO-DIGIT-ADAPTER-REPORT.md",
  });
}

export function bridgeRelianceDraft(input: unknown): DraftSampleTrace {
  const draft = relianceSchema.parse(input);
  const trace = draft.sampleResolutionTrace;
  const source = draft.sourceIdentity;
  const evidence = [citation({
    sourceKind: "POLICY_PDF",
    file: "pvt-car-comprehensive-reliance.pdf",
    page: 2,
  })];
  return draftSampleTraceSchema.parse({
    insurer: "RELIANCE_INDUSIND",
    adapterStatus: "DRAFT_NOT_APPROVED",
    decisionStatus: trace.status,
    reasonCode: trace.reasonCode,
    sourceFile: source.fileName,
    sourcePath: source.relativePath,
    sourceSha256: source.sha256,
    gridSelection: {
      status: "NO_APPLICABLE_VERSION",
      anchorKind: trace.dateAnchor.kind,
      anchorDate: trace.dateAnchor.resolvedDate,
      effectiveFrom: null,
      latestGridFallbackUsed: trace.latestGridFallbackUsed,
      reason: trace.gridApplicability,
      evidence,
    },
    rateAdjustments: [{
      ruleId: "RELIANCE_H3_UNDER_1000_CC",
      operation: "MULTIPLY_RATE",
      operand: "0.95",
      status: "NOT_APPLIED",
      reason: "The relative reduction is preserved as multiplier 0.95 but is not applied because the supplied grid does not cover the issue-date anchor.",
      evidence: [
        citation({
          sourceKind: "COMMISSION_GRID_XLSX",
          file: source.fileName,
          sheet: "PRIVATE CAR COMP, SAOD & STP",
          cell: "H3",
        }),
        citation({
          sourceKind: "OWNER_CLARIFICATION",
          file: "docs/phase-0/reliance-rulebook.md",
          locator: "2026-11-23 H3 clarification",
        }),
      ],
    }],
    components: components({
      od: {
        component: "OD",
        applicability: "UNRESOLVED",
        status: "UNSUPPORTED",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence,
        reason: "The provided grid does not cover the issue-date anchor.",
      },
      tp: {
        component: "TP",
        applicability: "UNRESOLVED",
        status: "UNSUPPORTED",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence,
        reason: "The provided grid does not cover the issue-date anchor.",
      },
      package: {
        component: "PACKAGE",
        applicability: "UNRESOLVED",
        status: "UNSUPPORTED",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence,
        reason: "The provided grid does not cover the issue-date anchor.",
      },
    }),
    uninterpretedMetrics: [],
    payoutStages: [{
      stage: "BASE_COMMISSION",
      status: "NOT_CALCULATED",
      reason: "No temporally applicable grid; no rate or payout is calculated.",
      evidence,
    }],
    trace: [
      { sequence: 1, stage: "DATE_ANCHOR", status: "COMPLETED", summary: `Policy issue-date anchor: ${trace.dateAnchor.resolvedDate ?? "missing"}.`, evidence },
      { sequence: 2, stage: "GRID_VERSION", status: "BLOCKED", summary: trace.gridApplicability, evidence: [] },
      { sequence: 3, stage: "RATE_RESOLUTION", status: "BLOCKED", summary: "The later-labelled grid is not selected retrospectively.", evidence },
      { sequence: 4, stage: "PAYOUT", status: "BLOCKED", summary: "Final commission and payout remain withheld.", evidence },
    ],
    sourceReport: "phase-2b-reliance/artifacts/reliance-private-car/RELIANCE-ADAPTER-REPORT.md",
  });
}

export function bridgeTataAigDraft(input: unknown): DraftSampleTrace {
  const draft = tataSchema.parse(input);
  const trace = draft.sampleResolutionTrace;
  const source = draft.sourceIdentity;
  const rateEvidence = trace.candidateTypes.flatMap((candidate) =>
    candidate.rowEvidence.map((item) => citation({
      sourceKind: "COMMISSION_GRID_XLSX",
      file: source.fileName,
      sheet: item.source.sheet,
      cell: item.source.cell,
    })),
  );
  const basisEvidence = trace.baseRateCandidate.basisEvidence.map((item) => citation({
    sourceKind: item.sourceKind,
    file: item.file,
    sheet: item.sheet,
    cell: item.cell,
  }));
  return draftSampleTraceSchema.parse({
    insurer: "TATA_AIG",
    adapterStatus: "DRAFT_NOT_APPROVED",
    decisionStatus: "AMBIGUOUS",
    reasonCode: "DATE_ANCHOR_AND_ALL_IN_PAYOUT_UNRESOLVED",
    sourceFile: source.fileName,
    sourcePath: source.relativePath,
    sourceSha256: source.sha256,
    gridSelection: {
      status: "UNRESOLVED",
      anchorKind: "POLICY_ISSUE_DATE_OR_INSURER_DEFINED_LOGIN_DATE",
      anchorDate: null,
      effectiveFrom: null,
      latestGridFallbackUsed: false,
      reason: "Policy issue date is not established and no authoritative login-date anchor is supplied; cover start is not substituted.",
      evidence: [],
    },
    rateAdjustments: [],
    components: components({
      od: {
        component: "OD",
        applicability: "NOT_APPLICABLE",
        status: "NOT_APPLICABLE",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence: [],
        reason: "The sample is stand-alone TP.",
      },
      tp: {
        component: "TP",
        applicability: "APPLICABLE",
        status: "WITHHELD",
        finalRatePercent: null,
        candidateRatePercent: trace.baseRateCandidate.displayedPercent.replace("%", ""),
        evidence: rateEvidence,
        reason: "The invariant standard-grid value is a base candidate only; date/version, override status, and COA inputs remain pending.",
      },
      package: {
        component: "PACKAGE",
        applicability: "NOT_APPLICABLE",
        status: "NOT_APPLICABLE",
        finalRatePercent: null,
        candidateRatePercent: null,
        evidence: [],
        reason: "The sample is stand-alone TP.",
      },
    }),
    uninterpretedMetrics: [],
    payoutStages: trace.stages.map((stage) => ({
      stage: stage.stage,
      status: "PENDING",
      reason: stage.reason,
      evidence: [],
    })),
    trace: [
      { sequence: 1, stage: "DATE_ANCHOR", status: "BLOCKED", summary: "Policy issue-date/login-date anchor is not established; cover start is not substituted.", evidence: [] },
      { sequence: 2, stage: "BASE_GRID", status: "COMPLETED", summary: `${trace.baseRateCandidate.displayedPercent} is invariant across all seven candidate Type rows; no body-type mapping is asserted.`, evidence: rateEvidence },
      { sequence: 3, stage: "OVERRIDE_SELECTION", status: "BLOCKED", summary: "Override status for intermediary code 721 is unverified; hierarchy dimensions remain separate.", evidence: [] },
      { sequence: 4, stage: "INCREMENTAL_COA", status: "BLOCKED", summary: "Producer GWP, slab, increment, basis, eligibility, and all-inclusive status are not evidenced.", evidence: [] },
      { sequence: 5, stage: "SETTLEMENT", status: "BLOCKED", summary: "No signed settlement entries or authoritative accounting semantics are available.", evidence: [] },
    ],
    sourceReport: "phase-2b-tata-aig/artifacts/tata-aig-satp/TATA-AIG-ADAPTER-REPORT.md",
  });
}

export function buildDraftSampleTraces(drafts: {
  hdfc: unknown;
  goDigit: unknown;
  reliance: unknown;
  tataAig: unknown;
}): DraftSampleTrace[] {
  return [
    bridgeHdfcDraft(drafts.hdfc),
    bridgeGoDigitDraft(drafts.goDigit),
    bridgeRelianceDraft(drafts.reliance),
    bridgeTataAigDraft(drafts.tataAig),
  ];
}
