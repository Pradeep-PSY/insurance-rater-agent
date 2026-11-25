import { analysisResultSchema, type AnalysisResult, type Evidence, type FactRecord } from "./contracts.js";

export const resolverVersion = "1.0.0";

export function resolveUnconfiguredPolicy(input: {
  runId: string;
  documentId: string;
  fileName: string;
  facts: FactRecord[];
  parserVersion: string;
  extractorVersion: string | null;
  extractionReason: string;
  lowTextPages: number[];
  ocr: {
    providerId: string;
    version: string | null;
    status: "NOT_REQUIRED" | "NOT_CONFIGURED" | "PROVIDED";
  };
}): AnalysisResult {
  const systemEvidence: Evidence[] = [{
    sourceKind: "SYSTEM_DERIVATION",
    fileName: input.fileName,
    sourceSha256: null,
    pageNumber: null,
    sheetName: null,
    cellRange: null,
    quote: null,
    validation: "NOT_APPLICABLE",
    ocrConfidence: null,
    extraction: { method: "NOT_APPLICABLE", providerId: null, version: null },
    geometry: null,
  }];
  const missingRequiredFacts = input.facts.filter((fact) =>
    ["insurer", "policyType", "issueDate", "fuel", "rto", "engineCapacityCc"].includes(fact.field) &&
    fact.status !== "KNOWN",
  );
  const result = {
    runId: input.runId,
    documentId: input.documentId,
    processingStatus: "COMPLETED" as const,
    decisionStatus: "UNSUPPORTED" as const,
    selectedRuleset: { id: null, version: null, status: "NOT_SELECTED" as const },
    facts: input.facts,
    components: [
      {
        component: "OD" as const,
        applicability: "UNRESOLVED" as const,
        status: "UNSUPPORTED" as const,
        ratePercent: null,
        candidateRatePercent: null,
        premiumBasis: null,
        evidence: systemEvidence,
        reason: "Policy coverage type and approved applicable rule bundle are unavailable.",
      },
      {
        component: "TP" as const,
        applicability: "UNRESOLVED" as const,
        status: "UNSUPPORTED" as const,
        ratePercent: null,
        candidateRatePercent: null,
        premiumBasis: null,
        evidence: systemEvidence,
        reason: "Policy facts and an approved applicable rule bundle are unavailable.",
      },
      {
        component: "PACKAGE" as const,
        applicability: "UNRESOLVED" as const,
        status: "UNSUPPORTED" as const,
        ratePercent: null,
        candidateRatePercent: null,
        premiumBasis: null,
        evidence: systemEvidence,
        reason: "Policy facts and an approved applicable rule bundle are unavailable.",
      },
    ],
    ruleMatches: [],
    rateAdjustments: [],
    uninterpretedMetrics: [],
    gridSelection: {
      insurer: null,
      dateAnchorKind: "UNRESOLVED" as const,
      resolvedAnchorDate: null,
      selectedBundle: null,
      effectivePeriod: null,
      coverageStatus: "UNRESOLVED" as const,
      dateAnchorEvidence: systemEvidence,
      selectionEvidence: systemEvidence,
      reasonCode: "INSURER_UNKNOWN" as const,
      reason: "Insurer and date-anchor facts are unavailable; no ruleset is selected and latest-grid fallback is forbidden.",
    },
    payoutStages: {
      baseCommission: {
        status: "NOT_CALCULATED" as const,
        formula: "UNRESOLVED" as const,
        premiumBasis: "UNRESOLVED" as const,
        inputs: [],
        outputInr: null,
        reason: "No applicable base commission rule or eligible premium basis is established.",
        evidence: systemEvidence,
      },
      incrementalCoa: {
        status: "NOT_CALCULATED" as const,
        formula: "UNRESOLVED" as const,
        premiumBasis: null,
        inputs: [
          { name: "producerGwp", value: null, unit: "INR" as const, evidence: systemEvidence },
          { name: "applicableSlab", value: null, unit: "TEXT" as const, evidence: systemEvidence },
          { name: "allInclusiveStatus", value: null, unit: "TEXT" as const, evidence: systemEvidence },
          { name: "threshold", value: null, unit: "INR" as const, evidence: systemEvidence },
          { name: "increment", value: null, unit: "PERCENT" as const, evidence: systemEvidence },
          { name: "basis", value: null, unit: "TEXT" as const, evidence: systemEvidence },
          { name: "eligibility", value: null, unit: "TEXT" as const, evidence: systemEvidence },
        ],
        outputInr: null,
        reason: "Producer GWP, applicable slab, increment, eligibility, and all-inclusive status are not evidenced.",
        evidence: systemEvidence,
      },
      grossPayout: {
        status: "NOT_CALCULATED" as const,
        formula: "UNRESOLVED" as const,
        premiumBasis: null,
        inputs: [
          { name: "baseCommission", value: null, unit: "INR" as const, evidence: systemEvidence },
          { name: "incrementalCoa", value: null, unit: "INR" as const, evidence: systemEvidence },
        ],
        outputInr: null,
        reason: "Gross payout cannot be calculated until base commission and eligible incremental COA are established.",
        evidence: systemEvidence,
      },
      settlementAdjustments: [{
        status: "NOT_CALCULATED" as const,
        formula: "UNRESOLVED" as const,
        premiumBasis: null,
        inputs: [{ name: "accountingSemantics", value: null, unit: "TEXT" as const, evidence: systemEvidence }],
        outputInr: null,
        reason: "No settlement amount or authoritative signed accounting semantics are available.",
        evidence: systemEvidence,
      }],
      netPayable: {
        status: "NOT_CALCULATED" as const,
        formula: "UNRESOLVED" as const,
        premiumBasis: null,
        inputs: [
          { name: "grossPayout", value: null, unit: "INR" as const, evidence: systemEvidence },
          { name: "settlementAdjustments", value: null, unit: "INR" as const, evidence: systemEvidence },
        ],
        outputInr: null,
        reason: "Net payable is withheld because gross payout and signed settlement adjustments are unresolved.",
        evidence: systemEvidence,
      },
    },
    trace: [
      {
        sequence: 1,
        stage: "DOCUMENT_VALIDATION",
        status: "COMPLETED" as const,
        summary: "PDF signature, structure, page count, byte size, and SHA-256 were validated.",
        evidence: systemEvidence,
      },
      {
        sequence: 2,
        stage: "TEXT_EXTRACTION",
        status: "COMPLETED" as const,
        summary: `PDF.js inspected ${input.lowTextPages.length} low-text pages; extracted text and page geometry are stored privately for evidence validation.`,
        evidence: systemEvidence,
      },
      {
        sequence: 3,
        stage: input.lowTextPages.length > 0 ? "OCR" : "POLICY_FACT_EXTRACTION",
        status: input.lowTextPages.length > 0 ? "BLOCKED" as const : "BLOCKED" as const,
        summary: input.extractionReason,
        evidence: systemEvidence,
      },
      {
        sequence: 4,
        stage: "GRID_VERSION_SELECTION",
        status: "BLOCKED" as const,
        summary: "No insurer or policy issue-date facts are validated; no grid version is selected and no latest-grid fallback is allowed.",
        evidence: systemEvidence,
      },
      {
        sequence: 5,
        stage: "RATE_RESOLUTION",
        status: "BLOCKED" as const,
        summary: "No approved production commission rules are available in the repository.",
        evidence: systemEvidence,
      },
    ],
    confidence: {
      level: "NOT_ASSESSED" as const,
      reasons: [
        "No policy facts have been verified by a configured extraction provider.",
        "Adapter outputs are drafts and no approved production ruleset has been published.",
      ],
    },
    unresolvedIssues: [
      {
        code: "POLICY_EXTRACTION_NOT_CONFIGURED",
        description: input.extractionReason,
        blocking: true,
        evidence: systemEvidence,
      },
      ...(input.lowTextPages.length > 0 ? [{
        code: "OCR_NOT_CONFIGURED",
        description: `Low-text pages require OCR: ${input.lowTextPages.join(", ")}.`,
        blocking: true,
        evidence: systemEvidence,
      }] : []),
      ...(missingRequiredFacts.length > 0 ? [{
        code: "REQUIRED_POLICY_FACTS_MISSING",
        description: `Required facts are missing: ${missingRequiredFacts.map((fact) => fact.field).join(", ")}.`,
        blocking: true,
        evidence: systemEvidence,
      }] : []),
      {
        code: "NO_APPROVED_RULESET",
        description: "All current insurer adapter outputs are drafts; no approved rule bundle is available for runtime selection.",
        blocking: true,
        evidence: systemEvidence,
      },
    ],
    versions: {
      parser: input.parserVersion,
      extractor: input.extractorVersion,
      ocr: input.ocr,
      resolver: resolverVersion,
    },
  };
  return analysisResultSchema.parse(result);
}
