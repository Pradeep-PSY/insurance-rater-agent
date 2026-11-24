import { z } from "zod";
import { evidenceReferenceSchema } from "./evidence.js";
import { factSchema } from "./fact.js";
import { ruleConditionSchema, ruleEffectSchema } from "./grid.js";
import { rateComponentResultSchema } from "./result.js";

const hdfcRateEvidence = evidenceReferenceSchema.parse({
  evidenceId: "hdfc-grid-package-rate",
  sourceKind: "COMMISSION_GRID_PDF",
  fileName: "Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf",
  pageNumber: 1,
  extractionMethod: "PDF_TEXT",
  notes: "Candidate rate row; policy fuel is not printed in the supplied schedule.",
});

export const hdfcPackageRateExample = rateComponentResultSchema.parse({
  component: "PACKAGE",
  applicability: "APPLICABLE",
  status: "AMBIGUOUS",
  ratePercent: null,
  candidateRatePercent: "17.50",
  premiumBasis: "TOTAL_NET_PACKAGE_PREMIUM",
  premiumBasisAmount: { amount: "11869.00", currency: "INR" },
  matchedRuleIds: ["HDFC-PACKAGE-RATE-CANDIDATE"],
  evidence: [hdfcRateEvidence],
  reasons: ["Package rate applies to total net package premium, OD plus TP/liability, excluding GST."]
});

export const goDigitRawMetricExample = ruleEffectSchema.parse({
  kind: "RAW_METRIC",
  rawLabel: "Max CD2",
  rawValue: "0.295",
  displayUnit: "PERCENT_FORMATTED",
  meaningStatus: "UNRESOLVED",
  eligibleForCommissionOutput: false,
});

export const relianceAdjustmentExample = ruleEffectSchema.parse({
  kind: "RELATIVE_ADJUSTMENT",
  operation: "MULTIPLY_RATE",
  factor: "0.95",
  description: "5% relative reduction from the base commission rate.",
});

export const tataBaseRateConditionExample = ruleConditionSchema.parse({
  dimension: "vehicleType",
  operator: "ALL",
});

export const tataGridSelectionExample = {
  insurer: "TATA_AIG",
  dateAnchorKind: "POLICY_ISSUE_DATE",
  resolvedAnchorDate: "2026-04-01",
  selectedBundleId: "TATA-AIG-STANDARD-GRID-MAR-2026",
  selectedBundleVersion: "MAR26_F_V2_0212",
  selectedSourceId: "TATA-AIG-PVTCAR-WORKBOOK",
  effectiveFrom: "2025-11-01",
  effectiveTo: null,
  coverageStatus: "COVERED",
  selectionEvidence: [{
    evidenceId: "tata-pvtcar-f1",
    sourceKind: "COMMISSION_GRID_XLSX",
    fileName: "Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx",
    sheetName: "Pvtcar",
    cellRange: "F1",
    extractionMethod: "EXCEL_CELL",
  }],
  unresolvedReasonCode: "NONE",
  reason: "The resolved issue-date anchor falls on or after the explicitly evidenced 1-Nov-2025 standard-grid effective-from date.",
} as const;

export const derivedBusinessTypeFactExample = factSchema(z.string()).parse({
  status: "KNOWN",
  value: "RENEWAL",
  provenance: "DERIVED",
  evidence: [{
    evidenceId: "owner-rule-same-insurer-renewal",
    sourceKind: "CHALLENGE_BRIEF",
    fileName: "challenge.md",
    section: "Terms used in the source files",
    lineRange: "L27-L28",
    extractionMethod: "MANUAL_REVIEW",
    quote: "When a policy names the same insurer as both the current and previous insurer, classify it as a renewal.",
  }],
  confidence: "HIGH",
  derivation: {
    formula: "currentInsurer.code === previousInsurer.code ? RENEWAL : UNKNOWN",
    inputFactPaths: ["insurer", "previousInsurer"],
  },
});

export const phase1SchemaVersion = "1.0.0" as const;
