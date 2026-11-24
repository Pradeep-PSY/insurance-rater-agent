import { describe, expect, it } from "vitest";
import { evidenceReferenceSchema } from "./evidence.js";
import {
  gridSelectionResultSchema,
  ruleConditionSchema,
  ruleEffectSchema,
  ruleBundleSchema,
} from "./grid.js";
import { payoutCalculationSchema, processingStatusSchema, rateComponentResultSchema } from "./result.js";
import { factSchema } from "./fact.js";
import { z } from "zod";
import {
  goDigitRawMetricExample,
  hdfcPackageRateExample,
  relianceAdjustmentExample,
  tataBaseRateConditionExample,
} from "./contract-examples.js";

describe("Phase 1 canonical contracts", () => {
  it("preserves a package rate without inventing separate OD or TP rates", () => {
    expect(hdfcPackageRateExample.component).toBe("PACKAGE");
    expect(hdfcPackageRateExample.premiumBasis).toBe("TOTAL_NET_PACKAGE_PREMIUM");
    expect(hdfcPackageRateExample.candidateRatePercent).toBe("17.50");
    expect(hdfcPackageRateExample.ratePercent).toBeNull();
  });

  it("keeps Go Digit Max CD2 as an uninterpreted raw metric", () => {
    expect(goDigitRawMetricExample.kind).toBe("RAW_METRIC");
    if (goDigitRawMetricExample.kind === "RAW_METRIC") {
      expect(goDigitRawMetricExample.meaningStatus).toBe("UNRESOLVED");
      expect(goDigitRawMetricExample.eligibleForCommissionOutput).toBe(false);
    }
  });

  it("represents Reliance 5% lesser as a relative multiplier", () => {
    expect(relianceAdjustmentExample.kind).toBe("RELATIVE_ADJUSTMENT");
    if (relianceAdjustmentExample.kind === "RELATIVE_ADJUSTMENT") {
      expect(relianceAdjustmentExample.factor).toBe("0.95");
    }
  });

  it("allows an ALL condition for Tata AIG's invariant vehicle-type rows", () => {
    expect(tataBaseRateConditionExample.operator).toBe("ALL");
  });

  it("requires a page number for PDF evidence", () => {
    const result = evidenceReferenceSchema.safeParse({
      evidenceId: "missing-page",
      sourceKind: "POLICY_PDF",
      fileName: "policy.pdf",
      extractionMethod: "OCR",
    });
    expect(result.success).toBe(false);
  });

  it("requires sheet and cell range for Excel evidence", () => {
    const result = evidenceReferenceSchema.safeParse({
      evidenceId: "missing-cell",
      sourceKind: "COMMISSION_GRID_XLSX",
      fileName: "grid.xlsx",
      sheetName: "Rates",
      extractionMethod: "EXCEL_CELL",
    });
    expect(result.success).toBe(false);
  });

  it("requires explicit lower and upper boundary rules for BETWEEN", () => {
    const result = ruleConditionSchema.safeParse({
      dimension: "engineCC",
      operator: "BETWEEN",
      value: { min: 1001, max: 1500 },
    });
    expect(result.success).toBe(false);
  });

  it("does not encode not-applicable OD as a zero-percent rate", () => {
    const result = rateComponentResultSchema.parse({
      component: "OD",
      applicability: "NOT_APPLICABLE",
      status: "NOT_APPLICABLE",
      ratePercent: null,
      candidateRatePercent: null,
      premiumBasis: "NONE",
      premiumBasisAmount: null,
      matchedRuleIds: [],
      evidence: [],
      reasons: ["Stand-alone TP policy has no OD component."],
    });
    expect(result.ratePercent).toBeNull();
  });

  it("rejects a resolved decision without an approved rate", () => {
    const result = rateComponentResultSchema.safeParse({
      component: "TP",
      applicability: "APPLICABLE",
      status: "RESOLVED",
      ratePercent: null,
      candidateRatePercent: "29.50",
      premiumBasis: "TP_NET_PREMIUM",
      premiumBasisAmount: null,
      matchedRuleIds: [],
      evidence: [],
      reasons: [],
    });
    expect(result.success).toBe(false);
  });

  it("separates processing lifecycle from decision status", () => {
    expect(processingStatusSchema.parse("COMPLETED")).toBe("COMPLETED");
  });

  it("requires a real selected bundle and source for a covered grid", () => {
    const result = gridSelectionResultSchema.safeParse({
      insurer: "RELIANCE_INDUSIND",
      dateAnchorKind: "POLICY_ISSUE_DATE",
      resolvedAnchorDate: "2025-12-12",
      selectedBundleId: null,
      selectedBundleVersion: null,
      selectedSourceId: null,
      effectiveFrom: null,
      effectiveTo: null,
      coverageStatus: "COVERED",
      selectionEvidence: [{
        evidenceId: "selection-evidence",
        sourceKind: "CHALLENGE_BRIEF",
        fileName: "challenge.md",
        extractionMethod: "MANUAL_REVIEW",
      }],
      unresolvedReasonCode: "NO_COVERING_GRID",
      reason: "Invalid covered selection.",
    });
    expect(result.success).toBe(false);
  });

  it("supports Reliance unsupported grid selection without silently choosing the latest grid", () => {
    const result = gridSelectionResultSchema.parse({
      insurer: "RELIANCE_INDUSIND",
      dateAnchorKind: "POLICY_ISSUE_DATE",
      resolvedAnchorDate: "2025-12-12",
      selectedBundleId: null,
      selectedBundleVersion: null,
      selectedSourceId: null,
      effectiveFrom: null,
      effectiveTo: null,
      coverageStatus: "NOT_COVERED",
      selectionEvidence: [{
        evidenceId: "reliance-grid-date",
        sourceKind: "COMMISSION_GRID_XLSX",
        fileName: "Reliance-Feb-2026.xlsx",
        sheetName: "PRIVATE CAR COMP, SAOD & STP",
        cellRange: "A11:F11",
        extractionMethod: "EXCEL_CELL",
      }],
      unresolvedReasonCode: "NO_COVERING_GRID",
      reason: "No supplied grid covers the 12-Dec-2025 policy issue date.",
    });
    expect(result.coverageStatus).toBe("NOT_COVERED");
  });

  it("supports typed decline, exclusion and unresolved adjustment effects", () => {
    expect(ruleEffectSchema.parse({
      kind: "DECLINE",
      reasonCode: "ALL_INDIA_DECLINE",
      description: "All-India decline requires source-defined handling.",
      declineScope: "CLUSTER",
    }).kind).toBe("DECLINE");

    expect(ruleEffectSchema.parse({
      kind: "EXCLUSION",
      reasonCode: "UNNAMED_FEW_RTO_EXCLUSION",
      description: "Specific affected RTOs are not identified.",
      appliesTo: "TP",
    }).kind).toBe("EXCLUSION");

    expect(ruleEffectSchema.parse({
      kind: "UNRESOLVED_ADJUSTMENT",
      reasonCode: "OPERATION_UNDEFINED",
      description: "The source operation is not yet authoritative.",
    }).kind).toBe("UNRESOLVED_ADJUSTMENT");
  });

  it("supports explicit percentage-point and fixed adjustment operations", () => {
    const percentagePoint = ruleEffectSchema.parse({
      kind: "PERCENTAGE_POINT_ADJUSTMENT",
      operation: "SUBTRACT_PERCENTAGE_POINTS",
      value: "2.5",
      description: "Percentage-point reduction.",
    });
    if (percentagePoint.kind === "PERCENTAGE_POINT_ADJUSTMENT") {
      expect(percentagePoint.operation).toBe("SUBTRACT_PERCENTAGE_POINTS");
    }

    const fixedAmount = ruleEffectSchema.parse({
      kind: "FIXED_AMOUNT_ADJUSTMENT",
      operation: "ADD_FIXED_AMOUNT",
      amount: { amount: "100.00", currency: "INR" },
      description: "Flat amount adjustment.",
    });
    if (fixedAmount.kind === "FIXED_AMOUNT_ADJUSTMENT") {
      expect(fixedAmount.operation).toBe("ADD_FIXED_AMOUNT");
    }
  });

  it("requires evidence for ambiguous and invalid facts", () => {
    const ambiguousFact = factSchema(z.string()).safeParse({
      status: "AMBIGUOUS",
      value: null,
      candidates: [
        { value: "A", evidence: [] },
        { value: "B", evidence: [] },
      ],
      reason: "Conflicting candidates.",
      evidence: [],
    });
    expect(ambiguousFact.success).toBe(false);

    const invalidFact = factSchema(z.number()).safeParse({
      status: "INVALID",
      value: null,
      rawValue: "0001-01-01",
      evidence: [],
      reason: "Invalid manufacture date sentinel.",
    });
    expect(invalidFact.success).toBe(false);
  });

  it("keeps incremental COA pending when required Tata evidence is absent", () => {
    const effect = ruleEffectSchema.parse({
      kind: "INCREMENTAL_COA",
      valueType: "PERCENTAGE",
      value: "0.00",
      basis: "GWP",
      eligibilityRequiresGwpSlab: true,
      sourceMeaningStatus: "UNRESOLVED",
      producerGwp: null,
      applicableSlab: null,
      lowerThreshold: null,
      upperThreshold: null,
      thresholdInclusive: null,
      allInclusive: null,
      eligible: false,
      evidence: [],
    });
    expect(effect.kind).toBe("INCREMENTAL_COA");
  });

  it("preserves separate Tata payout stages", () => {
    const payout = payoutCalculationSchema.parse({
      status: "PENDING_EVIDENCE",
      baseCommissionRatePercent: "38.00",
      baseCommissionAmount: null,
      incrementalCoaStatus: "PENDING_EVIDENCE",
      incrementalCoaRatePercent: null,
      incrementalCoaAmount: null,
      grossPayoutStatus: "PENDING_EVIDENCE",
      grossPayout: null,
      settlementAdjustments: [],
      netPayableStatus: "PENDING_EVIDENCE",
      netPayable: null,
      notes: ["Incremental COA and settlement remain unresolved."],
    });
    expect(payout.baseCommissionRatePercent).toBe("38.00");
    expect(payout.incrementalCoaAmount).toBeNull();
  });
});
