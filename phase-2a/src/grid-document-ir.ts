import { z } from "zod";

export const jsonValueSchema: z.ZodType<
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const xlsxCellSchema = z.object({
  address: z.string().min(1),
  rawValue: jsonValueSchema,
  formula: z.string().optional(),
  cachedValue: jsonValueSchema.optional(),
  errorCode: z.string().optional(),
  numberFormat: z.string().optional(),
  styleId: z.number().int().nonnegative().optional(),
}).strict();

export const xlsxSheetSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  visibility: z.enum(["VISIBLE", "HIDDEN", "VERY_HIDDEN"]),
  dimension: z.string().nullable(),
  actualRowCount: z.number().int().nonnegative(),
  actualColumnCount: z.number().int().nonnegative(),
  mergedRanges: z.array(z.string()),
  cells: z.array(xlsxCellSchema),
}).strict();

export const pdfTextItemSchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
}).strict();

export const pdfPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  textItems: z.array(pdfTextItemSchema),
}).strict();

export const parserWarningSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["INFO", "WARNING", "BLOCKER"]),
  locator: z.string().optional(),
  message: z.string().min(1),
}).strict();

export const gridDocumentIRSchema = z.object({
  schemaVersion: z.literal("2A.0.0"),
  source: z.object({
    sourceId: z.string().min(1),
    insurerId: z.enum(["HDFC_ERGO", "GO_DIGIT", "RELIANCE_INDUSIND", "TATA_AIG", "UNKNOWN"]),
    fileName: z.string().min(1),
    relativePath: z.string().min(1),
    format: z.enum(["XLSX", "PDF"]),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    byteSize: z.number().int().nonnegative(),
    sourcePeriodLabel: z.string().optional(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    effectiveDateStatus: z.enum(["EXPLICIT", "LABEL_ONLY", "CONFLICTING", "UNKNOWN"]),
  }).strict(),
  workbook: z.object({
    sheets: z.array(xlsxSheetSchema),
  }).optional(),
  pdf: z.object({
    pages: z.array(pdfPageSchema),
  }).optional(),
  warnings: z.array(parserWarningSchema),
}).strict();

export type GridDocumentIR = z.infer<typeof gridDocumentIRSchema>;
