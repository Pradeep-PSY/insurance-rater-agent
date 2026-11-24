import { z } from "zod";
import { evidenceReferenceSchema } from "./evidence.js";
import type { EvidenceReference } from "./evidence.js";

const evidenceList = z.array(evidenceReferenceSchema);

/**
 * Facts are not plain values. Their status and provenance travel with them so
 * that missing, invalid, ambiguous, externally sourced and derived values
 * cannot silently become ordinary policy facts.
 */
export function factSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  const known = z.object({
    status: z.literal("KNOWN"),
    value: valueSchema,
    rawValue: z.string().optional(),
    provenance: z.enum([
      "POLICY_DOCUMENT",
      "COMMISSION_GRID",
      "EXTERNAL_REFERENCE",
      "OWNER_CLARIFICATION",
      "DERIVED",
    ]),
    evidence: evidenceList.min(1),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    derivation: z.object({
      formula: z.string().min(1),
      inputFactPaths: z.array(z.string().min(1)).min(1),
    }).optional(),
    notes: z.string().optional(),
  });

  const missing = z.object({
    status: z.literal("MISSING"),
    value: z.null(),
    evidence: evidenceList,
    reason: z.string().min(1),
  });

  const ambiguous = z.object({
    status: z.literal("AMBIGUOUS"),
    value: z.null(),
    candidates: z.array(z.object({
      value: valueSchema,
      evidence: evidenceList.min(1),
      rawValue: z.string().optional(),
    })).min(2),
    reason: z.string().min(1),
    evidence: evidenceList.min(1),
  });

  const invalid = z.object({
    status: z.literal("INVALID"),
    value: z.null(),
    rawValue: z.string().optional(),
    evidence: evidenceList.min(1),
    reason: z.string().min(1),
  });

  return z.discriminatedUnion("status", [known, missing, ambiguous, invalid]).superRefine((fact, context) => {
    if ("provenance" in fact && fact.status === "KNOWN" && fact.provenance === "DERIVED" && !("derivation" in fact && fact.derivation)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Derived facts require derivation details." });
    }
  });
}

export type FactStatus = "KNOWN" | "MISSING" | "AMBIGUOUS" | "INVALID";

export type Fact<T> =
  | {
      status: "KNOWN";
      value: T;
      rawValue?: string | undefined;
      provenance: "POLICY_DOCUMENT" | "COMMISSION_GRID" | "EXTERNAL_REFERENCE" | "OWNER_CLARIFICATION" | "DERIVED";
      evidence: EvidenceReference[];
      confidence: "HIGH" | "MEDIUM" | "LOW";
      derivation?: { formula: string; inputFactPaths: string[] } | undefined;
      notes?: string | undefined;
    }
  | {
      status: "MISSING";
      value: null;
      evidence: EvidenceReference[];
      reason: string;
    }
  | {
      status: "AMBIGUOUS";
      value: null;
      candidates: Array<{ value: T; evidence: EvidenceReference[]; rawValue?: string | undefined }>;
      evidence: EvidenceReference[];
      reason: string;
    }
  | {
      status: "INVALID";
      value: null;
      rawValue?: string | undefined;
      evidence: EvidenceReference[];
      reason: string;
    };
