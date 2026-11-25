import { z } from "zod";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const serializedGridCellSchema = z.object({
  address: z.string().regex(/^[A-Z]+\d+$/),
  rawValue: jsonValueSchema,
  formula: z.string().optional(),
  cachedValue: jsonValueSchema.optional(),
  errorCode: z.string().optional(),
  numberFormat: z.string().optional(),
  styleId: z.number().int().nonnegative().optional(),
}).strict();

export const serializedGridSheetSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  visibility: z.enum(["VISIBLE", "HIDDEN", "VERY_HIDDEN"]),
  dimension: z.string().nullable(),
  actualRowCount: z.number().int().nonnegative(),
  actualColumnCount: z.number().int().nonnegative(),
  mergedRanges: z.array(z.string()),
  cells: z.array(serializedGridCellSchema),
}).strict();

export const serializedPdfSchema = z.object({
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    textItems: z.array(z.object({
      text: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
    }).strict()),
  }).strict()),
}).strict();

export const serializedGridDocumentSchema = z.object({
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
    sheets: z.array(serializedGridSheetSchema),
  }).optional(),
  pdf: serializedPdfSchema.optional(),
  warnings: z.array(z.object({
    code: z.string().min(1),
    severity: z.enum(["INFO", "WARNING", "BLOCKER"]),
    locator: z.string().optional(),
    message: z.string().min(1),
  }).strict()),
}).strict();

export type SerializedGridCell = z.infer<typeof serializedGridCellSchema>;
export type SerializedGridSheet = z.infer<typeof serializedGridSheetSchema>;
export type SerializedGridDocument = z.infer<typeof serializedGridDocumentSchema>;

export const inventoryInputSchema = z.object({
  documents: z.array(serializedGridDocumentSchema),
  schemaVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  formatVersion: z.number().int().positive(),
  contents: z.record(z.string(), jsonValueSchema),
  manifestFound: z.boolean(),
  manifestError: z.string().nullable(),
  manifestVerifications: z.array(z.object({
    sourceId: z.string().min(1),
    insurerId: z.string().min(1),
    relativePath: z.string().min(1),
    absolutePath: z.string().min(1),
    gridParseDisposition: z.string().min(1),
    listedSha256: z.string().nullable(),
    actualSha256: z.string().nullable(),
    listedByteSize: z.number().int().nonnegative().nullable(),
    actualByteSize: z.number().int().nonnegative().nullable(),
    hashMatches: z.boolean(),
    byteSizeMatches: z.boolean(),
    exists: z.boolean(),
    status: z.enum(["PASS", "FAIL"]),
    error: z.string().nullable(),
  }).strict()),
  compactSummary: z.object({
    manifestPassCount: z.number().int().nonnegative(),
    manifestFailCount: z.number().int().nonnegative(),
    workbookCount: z.number().int().nonnegative(),
    pdfCount: z.number().int().nonnegative(),
    workbookSheetCount: z.number().int().nonnegative(),
    pdfPageCount: z.number().int().nonnegative(),
  }).strict(),
  noCommissionRulesEmitted: z.literal(true),
}).strict();
