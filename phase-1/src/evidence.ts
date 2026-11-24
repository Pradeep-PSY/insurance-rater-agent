import { z } from "zod";
import { isoDateSchema } from "./common.js";

export const evidenceSourceKindSchema = z.enum([
  "POLICY_PDF",
  "COMMISSION_GRID_PDF",
  "COMMISSION_GRID_XLSX",
  "CHALLENGE_BRIEF",
  "EXTERNAL_REFERENCE",
  "OWNER_CLARIFICATION",
  "SYSTEM_DERIVATION",
]);

export const extractionMethodSchema = z.enum([
  "PDF_TEXT",
  "OCR",
  "EXCEL_CELL",
  "MANUAL_REVIEW",
  "EXTERNAL_LOOKUP",
  "OWNER_INPUT",
  "DERIVED",
]);

/**
 * A citation points to the original evidence location. It must not point only
 * to normalized JSON because reviewers need to inspect the source document.
 */
export const evidenceReferenceSchema = z.object({
  evidenceId: z.string().min(1),
  sourceKind: evidenceSourceKindSchema,
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),

  pageNumber: z.number().int().positive().optional(),
  sheetName: z.string().optional(),
  cellRange: z.string().optional(),
  tableName: z.string().optional(),
  rowLabel: z.string().optional(),
  section: z.string().optional(),
  lineRange: z.string().optional(),

  quote: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  accessedOn: isoDateSchema.optional(),
  clarificationId: z.string().optional(),
  clarificationDate: isoDateSchema.optional(),
  extractionMethod: extractionMethodSchema,
  notes: z.string().optional(),
}).superRefine((value, context) => {
  if (value.sourceKind === "POLICY_PDF" || value.sourceKind === "COMMISSION_GRID_PDF") {
    if (!value.pageNumber) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "PDF evidence requires pageNumber." });
    }
    if (!value.fileName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "PDF evidence requires fileName." });
    }
  }

  if (value.sourceKind === "COMMISSION_GRID_XLSX") {
    if (!value.sheetName || !value.cellRange) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Excel evidence requires both sheetName and cellRange.",
      });
    }
    if (!value.fileName) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Excel evidence requires fileName." });
    }
  }

  if (value.sourceKind === "CHALLENGE_BRIEF" && !value.fileName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Challenge brief evidence requires fileName." });
  }

  if (value.sourceKind === "EXTERNAL_REFERENCE" && !value.sourceUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "External evidence requires sourceUrl." });
  }

  if (value.sourceKind === "OWNER_CLARIFICATION" && !value.clarificationId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Owner clarification requires clarificationId." });
  }
});

export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
