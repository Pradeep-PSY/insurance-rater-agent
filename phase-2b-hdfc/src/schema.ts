import { z } from "zod";

export const sourceTextItemSchema = z.object({
  itemIndex: z.number().int().nonnegative(),
  locator: z.string().min(1),
  text: z.string(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }).strict(),
}).strict();

export const textLocatorSchema = z.object({
  pageNumber: z.number().int().positive(),
  itemIndex: z.number().int().nonnegative(),
  locator: z.string().min(1),
}).strict();

export const pdfPageEvidenceSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  coordinateSystem: z.literal("PDF_POINTS_ORIGIN_BOTTOM_LEFT"),
  textItems: z.array(sourceTextItemSchema),
}).strict();

export const sourceIdentitySchema = z.object({
  sourceId: z.string().min(1),
  fileName: z.string().min(1),
  relativePath: z.string().min(1),
  format: z.literal("PDF"),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  byteSize: z.number().int().nonnegative(),
  phase2aEffectiveFrom: z.string().nullable(),
  phase2aEffectiveTo: z.string().nullable(),
  phase2aEffectiveDateStatus: z.enum(["EXPLICIT", "LABEL_ONLY", "CONFLICTING", "UNKNOWN"]),
}).strict();

export const sourceCitationSchema = z.object({
  sourceKind: z.enum([
    "INSURER_GRID_PDF",
    "PHASE_0_RULEBOOK",
    "PROJECT_OWNER_CLARIFICATION",
  ]),
  file: z.string().min(1),
  section: z.string().optional(),
  locator: textLocatorSchema.optional(),
}).strict();

export const rateHeaderSchema = z.object({
  columnIndex: z.number().int().positive(),
  fuelGroupRaw: z.string().min(1),
  fuelHeader: textLocatorSchema,
  ncbGroupRaw: z.string().min(1),
  ncbHeader: textLocatorSchema,
  columnCenterX: z.number(),
}).strict();

export const rateCellSchema = z.object({
  columnIndex: z.number().int().positive(),
  rawDisplayText: z.string().regex(/^\d+(?:\.\d+)?%$/),
  ratePercent: z.string().regex(/^\d+(?:\.\d+)?$/),
  source: textLocatorSchema,
  header: rateHeaderSchema,
}).strict();

export const rateSlabRowSchema = z.object({
  slabLabelRaw: z.string().min(1),
  slabInterpretationStatus: z.literal("SOURCE_LABEL_ONLY_ENDPOINT_SEMANTICS_NOT_ASSIGNED"),
  slabSource: textLocatorSchema,
  baselineY: z.number(),
  cells: z.array(rateCellSchema).length(3),
}).strict();

export const rateTableSchema = z.object({
  tableId: z.string().min(1),
  pageNumber: z.literal(1),
  zone: z.enum(["ZONE_1", "ZONE_2"]),
  productCategoryRaw: z.enum(["Package", "SAOD"]),
  rateScope: z.enum(["PACKAGE", "OD_COMPONENT"]),
  zoneHeader: textLocatorSchema,
  productHeader: textLocatorSchema,
  categoryHeader: textLocatorSchema,
  fuelHeaders: z.array(z.object({
    rawText: z.string().min(1),
    source: textLocatorSchema,
    columnIndexes: z.array(z.number().int().positive()).min(1),
  }).strict()).min(2),
  ncbHeaders: z.array(z.object({
    rawText: z.string().min(1),
    source: textLocatorSchema,
    columnIndexes: z.array(z.number().int().positive()).min(1),
  }).strict()).length(3),
  slabRows: z.array(rateSlabRowSchema).length(5),
}).strict();

export const geographyCellSchema = z.object({
  value: z.string().min(1),
  source: textLocatorSchema,
}).strict();

export const geographyRowSchema = z.object({
  pageNumber: z.union([z.literal(1), z.literal(2)]),
  baselineY: z.number(),
  region: geographyCellSchema.nullable(),
  state: geographyCellSchema.nullable(),
  regionContext: geographyCellSchema.nullable(),
  stateContext: geographyCellSchema.nullable(),
  zone1Areas: z.array(geographyCellSchema),
  zone2Areas: z.array(geographyCellSchema),
  sourceItems: z.array(textLocatorSchema).min(1),
}).strict();

export const geographyTableHeaderSchema = z.object({
  pageNumber: z.union([z.literal(1), z.literal(2)]),
  regionHeader: textLocatorSchema,
  stateNameHeader: textLocatorSchema,
  zone1Header: textLocatorSchema,
  zone2Header: textLocatorSchema,
}).strict();

export const footnoteSchema = z.object({
  rawText: z.string().min(1),
  source: textLocatorSchema,
}).strict();

export const conditionalCandidateSchema = z.object({
  ratePercent: z.string().regex(/^\d+(?:\.\d+)?$/),
  fuelGroupRaw: z.string().min(1),
  ncbGroupRaw: z.string().min(1),
  slabLabelRaw: z.string().min(1),
  slabSource: textLocatorSchema,
  status: z.literal("CONDITIONAL_CANDIDATE_NOT_FINAL"),
  source: textLocatorSchema,
}).strict();

export const sampleResolutionTraceSchema = z.object({
  samplePolicy: z.object({
    sourceKind: z.literal("PHASE_0_RULEBOOK"),
    sourceFile: z.string().min(1),
    section: z.string().min(1),
    referencedPolicyFile: z.string().min(1),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    registrationState: z.string().min(1),
    productDescription: z.string().min(1),
    currentNcbPercent: z.string().regex(/^\d+(?:\.\d+)?$/),
    netOwnDamagePremium: z.string().regex(/^\d+(?:\.\d+)?$/),
    netLiabilityPremium: z.string().regex(/^\d+(?:\.\d+)?$/),
    totalNetPackagePremium: z.string().regex(/^\d+(?:\.\d+)?$/),
    gst: z.string().regex(/^\d+(?:\.\d+)?$/),
    fuel: z.object({
      policyStatus: z.literal("MISSING"),
      unapprovedExternalCorroboration: z.string().min(1),
      sourceKind: z.literal("EXTERNAL_REFERENCE_NOT_APPROVED"),
    }).strict(),
  }).strict(),
  decisionStatus: z.literal("AMBIGUOUS"),
  reasonCode: z.literal("FUEL_EVIDENCE_MISSING_OR_UNAPPROVED"),
  selectedGridEffectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rateScope: z.literal("PACKAGE"),
  zone: z.literal("ZONE_2"),
  productTable: z.literal("Package"),
  gridLookupBasis: z.object({
    rawText: z.string().min(1),
    source: textLocatorSchema,
  }).strict(),
  payoutBasis: z.object({
    interpretation: z.literal("TOTAL_NET_PACKAGE_PREMIUM_OD_PLUS_TP_LIABILITY_EXCLUDING_GST"),
    provenance: z.literal("PROJECT_OWNER_CLARIFICATION"),
    source: sourceCitationSchema,
  }).strict(),
  componentApplicability: z.object({
    od: z.literal("NOT_SEPARATELY_SPECIFIED"),
    tp: z.literal("NOT_SEPARATELY_SPECIFIED"),
  }).strict(),
  conditionalCandidates: z.array(conditionalCandidateSchema),
  finalRatePercent: z.null(),
  finalPayoutAmount: z.null(),
  withheldReason: z.string().min(1),
}).strict();

export const adapterWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  source: textLocatorSchema.optional(),
}).strict();

export const hdfcErgoAdapterDraftSchema = z.object({
  adapterVersion: z.literal("0.1.0"),
  sourceIdentity: sourceIdentitySchema,
  sourceEffectiveDateText: z.object({
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    rawText: z.string().nullable(),
    source: textLocatorSchema.nullable(),
    extractionStatus: z.enum(["EXPLICIT_TEXT", "NOT_FOUND"]),
  }).strict(),
  inventory: z.object({
    pageCount: z.number().int().positive(),
    textItemCount: z.number().int().nonnegative(),
    pageTextItemCounts: z.array(z.object({
      pageNumber: z.number().int().positive(),
      count: z.number().int().nonnegative(),
    }).strict()),
    rateTableCount: z.number().int().nonnegative(),
    rateSlabRowCount: z.number().int().nonnegative(),
    rateCellCount: z.number().int().nonnegative(),
    geographyRowCount: z.number().int().nonnegative(),
    footnoteCount: z.number().int().nonnegative(),
    manifestVerification: z.object({
      status: z.literal("PASS"),
      listedSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
      actualSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
      listedByteSize: z.number().int().nonnegative(),
      actualByteSize: z.number().int().nonnegative(),
    }).strict(),
  }).strict(),
  layoutReconstruction: z.object({
    method: z.literal("DETERMINISTIC_COORDINATE_BASELINE_AND_X_COLUMN_GROUPING"),
    coordinateSystem: z.literal("PDF_POINTS_ORIGIN_BOTTOM_LEFT"),
    baselineTolerancePoints: z.number().positive(),
    limitations: z.array(z.string()),
  }).strict(),
  pages: z.array(pdfPageEvidenceSchema).length(2),
  rateTables: z.array(rateTableSchema).length(4),
  geographyTableHeaders: z.array(geographyTableHeaderSchema).length(2),
  geographyRows: z.array(geographyRowSchema).min(1),
  footnotes: z.array(footnoteSchema).min(1),
  semanticBasis: z.object({
    lookupSlabBasis: z.object({
      rawText: z.string().min(1),
      source: textLocatorSchema,
      meaning: z.literal("COMPREHENSIVE_PLUS_SAOD_GWP_EXCLUDING_SATP"),
      provenance: z.literal("INSURER_GRID_PDF"),
    }).strict(),
    payoutBasis: z.object({
      interpretation: z.literal("TOTAL_NET_PACKAGE_PREMIUM_OD_PLUS_TP_LIABILITY_EXCLUDING_GST"),
      provenance: z.literal("PROJECT_OWNER_CLARIFICATION"),
      source: sourceCitationSchema,
    }).strict(),
  }).strict(),
  sampleResolutionTrace: sampleResolutionTraceSchema,
  warnings: z.array(adapterWarningSchema),
  noApprovedCommissionRulesEmitted: z.literal(true),
}).strict();

export type HdfcErgoAdapterDraft = z.infer<typeof hdfcErgoAdapterDraftSchema>;
export type TextLocator = z.infer<typeof textLocatorSchema>;
