import { describe, expect, it } from "vitest";
import {
  analysisResultSchema,
  componentResultSchema,
  factSchema,
  gridSelectionSchema,
} from "../src/contracts.js";
import { resolveUnconfiguredPolicy } from "../src/resolver.js";
import {
  extractPolicyFacts,
  validateFactEvidence,
  type OcrProvider,
  type PolicyFactProvider,
} from "../src/providers.js";

const sourceHash = "a".repeat(64);

function policyEvidence(pageNumber: number, quote: string) {
  return {
    sourceKind: "POLICY_PDF" as const,
    fileName: "policy.pdf",
    sourceSha256: sourceHash,
    pageNumber,
    sheetName: null,
    cellRange: null,
    quote,
    validation: "VERIFIED" as const,
    ocrConfidence: null,
    extraction: { method: "PDF_TEXT" as const, providerId: null, version: "pdfjs-dist/6" },
    geometry: {
      x: 10,
      y: 12,
      width: 90,
      height: 8,
      pageWidth: 612,
      pageHeight: 792,
    },
  };
}

function baseFact() {
  return factSchema.parse({
    field: "issueDate",
    status: "KNOWN",
    rawValue: "26/03/2026",
    normalizedValue: "2026-03-26",
    provenance: "POLICY_DOCUMENT",
    confidence: "HIGH",
    evidence: [policyEvidence(1, "Issue Date 26/03/2026")],
    confidenceReason: "Directly printed on policy schedule.",
  });
}

function unsupportedResult() {
  return resolveUnconfiguredPolicy({
    runId: "11111111-1111-4111-8111-111111111111",
    documentId: "22222222-2222-4222-8222-222222222222",
    fileName: "additional-policy.pdf",
    facts: [{
      field: "insurer",
      status: "MISSING",
      rawValue: null,
      normalizedValue: null,
      provenance: "SYSTEM",
      confidence: "NOT_ASSESSED",
      evidence: [],
      confidenceReason: "Extraction is disabled.",
    }],
    parserVersion: "pdfjs-dist/5",
    extractorVersion: null,
    extractionReason: "Policy fact extraction is disabled.",
    lowTextPages: [1],
    ocr: { providerId: "disabled", version: null, status: "NOT_CONFIGURED" },
  });
}

describe("reviewer runtime contracts", () => {
  it("allows completed processing with an unsupported decision and no fabricated rates", () => {
    const result = unsupportedResult();
    expect(result.processingStatus).toBe("COMPLETED");
    expect(result.decisionStatus).toBe("UNSUPPORTED");
    expect(result.gridSelection.selectedBundle).toBeNull();
    expect(result.gridSelection.coverageStatus).toBe("UNRESOLVED");
    expect(result.components.every((item) => item.ratePercent === null)).toBe(true);
    expect(result.payoutStages.netPayable.outputInr).toBeNull();
  });

  it("rejects a selected grid whose effective period does not cover its date anchor", () => {
    const evidence = {
      sourceKind: "COMMISSION_GRID_PDF" as const,
      fileName: "grid.pdf",
      sourceSha256: sourceHash,
      pageNumber: 1,
      sheetName: null,
      cellRange: null,
      quote: "Effective 01-Feb-2025",
      validation: "VERIFIED" as const,
      ocrConfidence: null,
      extraction: { method: "PDF_TEXT" as const, providerId: null, version: "pdfjs-dist/6" },
      geometry: null,
    };
    const result = gridSelectionSchema.safeParse({
      insurer: "HDFC ERGO",
      dateAnchorKind: "POLICY_ISSUE_DATE",
      resolvedAnchorDate: "2026-03-26",
      selectedBundle: {
        id: "hdfc-2025",
        version: "2025-02",
        sourceFile: "grid.pdf",
        sourceSha256: sourceHash,
      },
      effectivePeriod: { from: "2025-02-01", to: "2025-12-31" },
      coverageStatus: "COVERED",
      dateAnchorEvidence: [policyEvidence(1, "Issue Date 26/03/2026")],
      selectionEvidence: [evidence],
      reasonCode: "SELECTED",
      reason: "Selected source.",
    });
    expect(result.success).toBe(false);
  });

  it("keeps matched-rule outcomes separate from Tata override and specificity dimensions", () => {
    const result = unsupportedResult();
    const parsed = analysisResultSchema.parse({
      ...result,
      ruleMatches: [{
        ruleId: "tata-standard-rate",
        outcome: "MATCHED",
        matchedConditions: ["Renewal", "SATP", "Delhi"],
        missingConditions: [],
        priorityDimensions: {
          overrideHierarchy: "STANDARD_GRID",
          ruleSpecificity: "BASE_STANDARD_ROW",
        },
        evidence: [policyEvidence(1, "Policy details")],
      }],
    });
    expect(parsed.ruleMatches[0]?.priorityDimensions).toEqual({
      overrideHierarchy: "STANDARD_GRID",
      ruleSpecificity: "BASE_STANDARD_ROW",
    });
  });

  it("preserves invalid and ambiguous fact states with evidence", () => {
    const invalid = factSchema.parse({
      field: "manufactureDate",
      status: "INVALID",
      rawValue: "0001-01-01",
      normalizedValue: null,
      provenance: "POLICY_DOCUMENT",
      confidence: "LOW",
      evidence: [policyEvidence(2, "0001-01-01")],
      confidenceReason: "The printed placeholder is not a usable manufacture date.",
    });
    expect(invalid.status).toBe("INVALID");
    expect(invalid.rawValue).toBe("0001-01-01");

    const ambiguous = factSchema.parse({
      field: "fuel",
      status: "AMBIGUOUS",
      rawValue: "Diesel / Petrol",
      normalizedValue: null,
      provenance: "POLICY_DOCUMENT",
      confidence: "LOW",
      evidence: [
        policyEvidence(1, "Fuel Diesel"),
        policyEvidence(2, "Fuel Petrol"),
      ],
      confidenceReason: "Two validated policy pages conflict.",
    });
    expect(ambiguous.status).toBe("AMBIGUOUS");
    expect(ambiguous.evidence).toHaveLength(2);
  });

  it("downgrades a policy fact when its claimed quote cannot be verified", () => {
    const fact = baseFact();
    const validated = validateFactEvidence({
      facts: [{ ...fact, evidence: [{ ...fact.evidence[0]!, quote: "Diesel" }] }],
      pages: [{
        pageNumber: 1,
        text: "Issue Date 26/03/2026",
        source: "PDF_TEXT",
        providerId: null,
        version: "pdfjs-dist/6",
        confidence: null,
        textBlocks: [{ text: "Issue Date 26/03/2026", x: 10, y: 12, width: 90, height: 8 }],
        pageWidth: 612,
        pageHeight: 792,
      }],
      fileName: "policy.pdf",
      sourceSha256: sourceHash,
    });
    expect(validated[0]?.status).toBe("INVALID");
    expect(validated[0]?.normalizedValue).toBeNull();
    expect(validated[0]?.evidence[0]?.validation).toBe("REJECTED");
  });

  it("rejects policy evidence whose geometry is outside the cited page", () => {
    const fact = baseFact();
    const validated = validateFactEvidence({
      facts: [{ ...fact, evidence: [{
        ...fact.evidence[0]!,
        geometry: { ...fact.evidence[0]!.geometry!, x: 600, width: 20 },
      }] }],
      pages: [{
        pageNumber: 1,
        text: "Issue Date 26/03/2026",
        source: "PDF_TEXT",
        providerId: null,
        version: "pdfjs-dist/6",
        confidence: null,
        textBlocks: [{ text: "Issue Date 26/03/2026", x: 10, y: 12, width: 90, height: 8 }],
        pageWidth: 612,
        pageHeight: 792,
      }],
      fileName: "policy.pdf",
      sourceSha256: sourceHash,
    });
    expect(validated[0]?.status).toBe("INVALID");
    expect(validated[0]?.evidence[0]?.validation).toBe("REJECTED");
  });

  it("preserves OCR provider/version and validates OCR quote, page, and geometry", async () => {
    const ocrProvider: OcrProvider = {
      providerId: "test-ocr",
      version: "2.1",
      async recognize() {
        return {
          pages: [{
            pageNumber: 1,
            text: "Fuel Diesel",
            confidence: 0.96,
            geometry: { x: 0, y: 0, width: 612, height: 792, pageWidth: 612, pageHeight: 792 },
            textBlocks: [{ text: "Fuel Diesel", x: 40, y: 80, width: 70, height: 10 }],
          }],
        };
      },
    };
    const factProvider: PolicyFactProvider = {
      providerId: "test-facts",
      version: "1.0",
      async extract() {
        return [{
          field: "fuel",
          status: "KNOWN",
          rawValue: "Diesel",
          normalizedValue: "DIESEL",
          provenance: "POLICY_DOCUMENT",
          confidence: "HIGH",
          confidenceReason: "The OCR quote directly states the fuel.",
          evidence: [{
            sourceKind: "POLICY_PDF",
            fileName: "policy.pdf",
            sourceSha256: sourceHash,
            pageNumber: 1,
            sheetName: null,
            cellRange: null,
            quote: "Fuel Diesel",
            validation: "NOT_APPLICABLE",
            ocrConfidence: null,
            extraction: { method: "OCR", providerId: "test-ocr", version: "2.1" },
            geometry: { x: 40, y: 80, width: 70, height: 10, pageWidth: 612, pageHeight: 792 },
          }],
        }];
      },
    };
    const inspection = {
      pageCount: 1,
      pages: [{
        pageNumber: 1,
        textItemCount: 0,
        textCharacterCount: 0,
        lowText: true,
        text: "",
        pageWidth: 612,
        pageHeight: 792,
        textBlocks: [],
      }],
      lowTextPageNumbers: [1],
    };
    const result = await extractPolicyFacts({
      pdfBytes: Buffer.from("%PDF-test"),
      inspection,
      ocrProvider,
      factProvider,
      fileName: "policy.pdf",
      sourceSha256: sourceHash,
    });
    expect(result.ocrStatus).toBe("PROVIDED");
    expect(result.ocrProvider).toEqual({ providerId: "test-ocr", version: "2.1" });
    expect(result.facts[0]?.status).toBe("KNOWN");
    expect(result.facts[0]?.evidence[0]?.validation).toBe("VERIFIED");
    expect(result.facts[0]?.evidence[0]?.extraction.method).toBe("OCR");

    const lowConfidenceOcr: OcrProvider = {
      ...ocrProvider,
      async recognize() {
        const recognized = await ocrProvider.recognize({ pdfBytes: Buffer.alloc(0), pages: [1] });
        return {
          pages: recognized.pages.map((page) => ({ ...page, confidence: 0.4 })),
        };
      },
    };
    const lowConfidenceResult = await extractPolicyFacts({
      pdfBytes: Buffer.from("%PDF-test"),
      inspection,
      ocrProvider: lowConfidenceOcr,
      factProvider,
      fileName: "policy.pdf",
      sourceSha256: sourceHash,
    });
    expect(lowConfidenceResult.facts[0]?.status).toBe("UNVERIFIED");
    expect(lowConfidenceResult.facts[0]?.normalizedValue).toBeNull();

    const missingConfidenceOcr: OcrProvider = {
      ...ocrProvider,
      async recognize() {
        const recognized = await ocrProvider.recognize({ pdfBytes: Buffer.alloc(0), pages: [1] });
        return {
          pages: recognized.pages.map((page) => ({ ...page, confidence: null })),
        };
      },
    };
    const missingConfidenceResult = await extractPolicyFacts({
      pdfBytes: Buffer.from("%PDF-test"),
      inspection,
      ocrProvider: missingConfidenceOcr,
      factProvider,
      fileName: "policy.pdf",
      sourceSha256: sourceHash,
    });
    expect(missingConfidenceResult.facts[0]?.status).toBe("UNVERIFIED");
    expect(missingConfidenceResult.facts[0]?.normalizedValue).toBeNull();
  });

  it("represents Go Digit Max CD2 as uninterpreted data, not a component commission", () => {
    const result = unsupportedResult();
    const parsed = analysisResultSchema.parse({
      ...result,
      uninterpretedMetrics: [{
        fieldName: "Max CD2",
        rawValue: "0.295",
        interpretationStatus: "UNINTERPRETED",
        evidence: [{
          sourceKind: "COMMISSION_GRID_XLSX",
          fileName: "godigit.xlsx",
          sourceSha256: sourceHash,
          pageNumber: null,
          sheetName: "4W SATP",
          cellRange: "E293",
          quote: null,
          validation: "VERIFIED",
          ocrConfidence: null,
          extraction: { method: "NOT_APPLICABLE", providerId: null, version: null },
          geometry: null,
        }],
      }],
    });
    expect(parsed.uninterpretedMetrics[0]?.rawValue).toBe("0.295");
    expect(parsed.components.every((item) => item.ratePercent === null)).toBe(true);
  });

  it("does not turn a SATP OD not-applicable status into zero percent", () => {
    const od = componentResultSchema.parse({
      component: "OD",
      applicability: "NOT_APPLICABLE",
      status: "NOT_APPLICABLE",
      ratePercent: null,
      candidateRatePercent: null,
      premiumBasis: null,
      evidence: [],
      reason: "Stand-alone TP policy has no OD cover.",
    });
    expect(od.ratePercent).toBeNull();
  });

  it("supports a HDFC package rate with OD and TP net premium inputs and GST excluded once", () => {
    const result = unsupportedResult();
    const evidence = [policyEvidence(1, "Net OD Premium 8053 Net TP Premium 3816")];
    const parsed = analysisResultSchema.parse({
      ...result,
      components: [
        {
          component: "OD",
          applicability: "NOT_SEPARATELY_SPECIFIED",
          status: "NOT_SEPARATELY_SPECIFIED",
          ratePercent: null,
          candidateRatePercent: null,
          premiumBasis: null,
          evidence,
          reason: "Source publishes one package rate.",
        },
        {
          component: "TP",
          applicability: "NOT_SEPARATELY_SPECIFIED",
          status: "NOT_SEPARATELY_SPECIFIED",
          ratePercent: null,
          candidateRatePercent: null,
          premiumBasis: null,
          evidence,
          reason: "Source publishes one package rate.",
        },
        {
          component: "PACKAGE",
          applicability: "APPLICABLE",
          status: "WITHHELD",
          ratePercent: null,
          candidateRatePercent: "17.50",
          premiumBasis: "OD + TP net premium; GST excluded",
          evidence,
          reason: "Candidate rate requires verified fuel evidence.",
        },
      ],
      payoutStages: {
        ...result.payoutStages,
        baseCommission: {
          ...result.payoutStages.baseCommission,
          premiumBasis: "PACKAGE_NET_PREMIUM",
          inputs: [
            { name: "odNetPremium", value: "8053", unit: "INR", evidence },
            { name: "tpLiabilityNetPremium", value: "3816", unit: "INR", evidence },
            { name: "gstExcluded", value: "true", unit: "TEXT", evidence },
            { name: "packageRate", value: "17.50", unit: "PERCENT", evidence },
          ],
        },
      },
    });
    expect(parsed.components.filter((item) => item.ratePercent !== null)).toHaveLength(0);
    expect(parsed.payoutStages.baseCommission.premiumBasis).toBe("PACKAGE_NET_PREMIUM");
  });

  it("preserves Reliance relative reduction as an explicit multiplier operation", () => {
    const result = unsupportedResult();
    const parsed = analysisResultSchema.parse({
      ...result,
      rateAdjustments: [{
        ruleId: "reliance-h3-under-1000cc",
        operation: "MULTIPLY_RATE",
        operand: "0.95",
        status: "UNRESOLVED",
        evidence: [],
        reason: "H3 relative reduction semantics are documented; no applicable dated grid is available.",
      }],
    });
    expect(parsed.rateAdjustments[0]?.operation).toBe("MULTIPLY_RATE");
    expect(parsed.rateAdjustments[0]?.operand).toBe("0.95");
  });

  it("requires complete COA inputs and leaves all payout stages independently uncalculated", () => {
    const result = unsupportedResult();
    expect(result.payoutStages.baseCommission.outputInr).toBeNull();
    expect(result.payoutStages.incrementalCoa.outputInr).toBeNull();
    expect(result.payoutStages.grossPayout.outputInr).toBeNull();
    expect(result.payoutStages.netPayable.outputInr).toBeNull();
    expect(result.payoutStages.settlementAdjustments[0]?.outputInr).toBeNull();
    const invalid = analysisResultSchema.safeParse({
      ...result,
      payoutStages: {
        ...result.payoutStages,
        incrementalCoa: { ...result.payoutStages.incrementalCoa, inputs: [] },
      },
    });
    expect(invalid.success).toBe(false);
  });
});
