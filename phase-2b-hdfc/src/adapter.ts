import { z } from "zod";
import {
  hdfcErgoAdapterDraftSchema,
  type HdfcErgoAdapterDraft,
  type TextLocator,
} from "./schema.js";

const hdfcGridPath =
  "raters/hdfc-ergo/feb-2025/Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf";
const phase0Rulebook = "docs/phase-0/hdfc-ergo-rulebook.md";
const phase0Section = "4. Package-rate basis – project-owner clarification";
const sampleSection = "2. Policy facts";
const coordinateTolerance = 0.2;

const pdfTextItemSchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
}).strict();

const pdfPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  textItems: z.array(pdfTextItemSchema),
}).strict();

const gridDocumentSchema = z.object({
  schemaVersion: z.literal("2A.0.0"),
  source: z.object({
    sourceId: z.string().min(1),
    insurerId: z.literal("HDFC_ERGO"),
    fileName: z.string().min(1),
    relativePath: z.string().min(1),
    format: z.literal("PDF"),
    sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    byteSize: z.number().int().nonnegative(),
    effectiveFrom: z.string().nullable(),
    effectiveTo: z.string().nullable(),
    effectiveDateStatus: z.enum(["EXPLICIT", "LABEL_ONLY", "CONFLICTING", "UNKNOWN"]),
  }).passthrough(),
  pdf: z.object({ pages: z.array(pdfPageSchema) }).strict(),
  warnings: z.array(z.object({
    code: z.string(),
    severity: z.enum(["INFO", "WARNING", "BLOCKER"]),
    locator: z.string().optional(),
    message: z.string(),
  }).passthrough()),
}).passthrough();

const manifestVerificationSchema = z.object({
  relativePath: z.string(),
  listedSha256: z.string().nullable(),
  actualSha256: z.string().nullable(),
  listedByteSize: z.number().int().nullable(),
  actualByteSize: z.number().int().nullable(),
  status: z.enum(["PASS", "FAIL"]),
}).passthrough();

const inventorySchema = z.object({
  documents: z.array(z.unknown()),
  manifestVerifications: z.array(manifestVerificationSchema),
  noCommissionRulesEmitted: z.literal(true),
}).passthrough();

type PdfTextItem = z.infer<typeof pdfTextItemSchema>;
type PdfPage = z.infer<typeof pdfPageSchema>;
type GridDocument = z.infer<typeof gridDocumentSchema>;
type Baseline = { y: number; items: Array<{ index: number; item: PdfTextItem }> };

function locator(pageNumber: number, itemIndex: number): TextLocator {
  return {
    pageNumber,
    itemIndex,
    locator: `page[${pageNumber}].textItems[${itemIndex}]`,
  };
}

function itemRef(pageNumber: number, item: { index: number }): TextLocator {
  return locator(pageNumber, item.index);
}

function itemText(items: Array<{ index: number; item: PdfTextItem }>): string {
  return items.map(({ item }) => item.text).join(" ");
}

function centerX(item: PdfTextItem): number {
  return item.x + item.width / 2;
}

function lineBaselines(page: PdfPage): Baseline[] {
  const sorted = page.textItems
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item.text.trim().length > 0)
    .sort((left, right) => right.item.y - left.item.y || left.item.x - right.item.x);
  const baselines: Baseline[] = [];

  for (const entry of sorted) {
    let baseline = baselines.find((candidate) =>
      Math.abs(candidate.y - entry.item.y) <= coordinateTolerance);
    if (!baseline) {
      baseline = { y: entry.item.y, items: [] };
      baselines.push(baseline);
    }
    baseline.items.push(entry);
  }

  return baselines
    .map((baseline) => ({
      ...baseline,
      items: baseline.items.sort((left, right) => left.item.x - right.item.x),
    }))
    .sort((left, right) => right.y - left.y);
}

function uniqueItem(
  page: PdfPage,
  predicate: (item: PdfTextItem) => boolean,
  description: string,
): { index: number; item: PdfTextItem } {
  const matches = page.textItems
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => predicate(item));
  if (matches.length !== 1) {
    throw new Error(`Expected one ${description}, found ${matches.length}.`);
  }
  return matches[0]!;
}

function parseEffectiveDate(page: PdfPage): {
  value: string | null;
  rawText: string | null;
  source: TextLocator | null;
  extractionStatus: "EXPLICIT_TEXT" | "NOT_FOUND";
} {
  const match = page.textItems
    .map((item, index) => ({ item, index }))
    .find(({ item }) => /Effective\s+from\s+\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,}['’]?\d{2,4}/i.test(item.text));
  if (!match) {
    return { value: null, rawText: null, source: null, extractionStatus: "NOT_FOUND" };
  }

  const date = /Effective\s+from\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})['’]?(\d{2,4})/i.exec(match.item.text);
  if (!date) {
    throw new Error("The effective-date text matched but could not be normalized deterministically.");
  }
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const day = Number(date[1]);
  const month = months[date[2]!.slice(0, 3).toLowerCase()];
  const parsedYear = Number(date[3]);
  const year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
  if (!month || day < 1 || day > 31) {
    throw new Error(`Unsupported effective-date text: ${match.item.text}`);
  }
  const value = `${String(year).padStart(4, "0")}-${month}-${String(day).padStart(2, "0")}`;
  return {
    value,
    rawText: match.item.text,
    source: locator(page.pageNumber, match.index),
    extractionStatus: "EXPLICIT_TEXT",
  };
}

function overlapColumnIndexes(
  header: PdfTextItem,
  intervals: Array<{ columnIndex: number; left: number; right: number; center: number }>,
): number[] {
  const start = header.x;
  const end = header.x + header.width;
  const overlapping = intervals
    .filter((interval) => Math.min(end, interval.right) - Math.max(start, interval.left) > 0)
    .map((interval) => interval.columnIndex);
  if (overlapping.length > 0) return overlapping;
  const nearest = [...intervals].sort((a, b) =>
    Math.abs(a.center - centerX(header)) - Math.abs(b.center - centerX(header)))[0];
  if (!nearest) throw new Error("A table header could not be associated with a rate column.");
  return [nearest.columnIndex];
}

function buildRateTables(page: PdfPage): HdfcErgoAdapterDraft["rateTables"] {
  const baselines = lineBaselines(page);
  const zoneItems = page.textItems
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item.text === "Zone 1" || item.text === "Zone 2");
  if (zoneItems.length !== 2) throw new Error(`Expected two rate-table zone headings; found ${zoneItems.length}.`);

  const zone1 = zoneItems.find(({ item }) => item.text === "Zone 1")!;
  const zone2 = zoneItems.find(({ item }) => item.text === "Zone 2")!;
  const zoneBounds = [
    { raw: "Zone 1", zone: "ZONE_1" as const, item: zone1, lowerY: zone2.item.y },
    { raw: "Zone 2", zone: "ZONE_2" as const, item: zone2, lowerY: 780 },
  ];
  const productHeadings = page.textItems
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item.text === "Package" || item.text === "SAOD");
  const categoryHeaders = page.textItems
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => item.text === "Category*");
  const rateBaselines = baselines.filter((baseline) =>
    baseline.items.some(({ item }) => /%$/.test(item.text)) &&
    baseline.items.some(({ item }) => /^(?:<|>)/.test(item.text.trim())));
  if (rateBaselines.length !== 10 || productHeadings.length !== 4 || categoryHeaders.length !== 2) {
    throw new Error(
      `Coordinate reconstruction boundary mismatch: slabs=${rateBaselines.length}, ` +
      `product headings=${productHeadings.length}, category headers=${categoryHeaders.length}.`,
    );
  }

  const tables: HdfcErgoAdapterDraft["rateTables"] = [];
  for (const zoneBoundary of zoneBounds) {
    const zoneProductHeadings = productHeadings.filter(({ item }) =>
      item.y < zoneBoundary.item.item.y && item.y > zoneBoundary.lowerY);
    const zoneCategory = categoryHeaders.filter(({ item }) =>
      item.y < zoneBoundary.item.item.y && item.y > zoneBoundary.lowerY);
    if (zoneProductHeadings.length !== 2 || zoneCategory.length !== 1) {
      throw new Error(`Could not reconstruct two product tables for ${zoneBoundary.raw}.`);
    }
    const zoneRows = rateBaselines.filter((baseline) =>
      baseline.y < zoneBoundary.item.item.y && baseline.y > zoneBoundary.lowerY);
    if (zoneRows.length !== 5) throw new Error(`Expected five slab rows for ${zoneBoundary.raw}.`);
    const zoneHeaderRef = itemRef(page.pageNumber, zoneBoundary.item);
    const zoneProductCenterXs = zoneProductHeadings
      .map(({ item }) => centerX(item))
      .sort((left, right) => left - right);
    const productSplitX = (zoneProductCenterXs[0]! + zoneProductCenterXs[1]!) / 2;

    for (const productHeading of zoneProductHeadings) {
      const productName = productHeading.item.text as "Package" | "SAOD";
      const isPackage = productName === "Package";
      const productRows = zoneRows.map((baseline) => {
        const slabItems = baseline.items.filter(({ item }) =>
          /^(?:<|>)/.test(item.text.trim()));
        const allRates = baseline.items.filter(({ item }) => /^\d+(?:\.\d+)?%$/.test(item.text));
        if (slabItems.length !== 1 || allRates.length !== 6) {
          throw new Error(`Malformed rate row at page ${page.pageNumber}, baseline ${baseline.y}.`);
        }
        const sortedRates = [...allRates].sort((left, right) => left.item.x - right.item.x);
        const half = sortedRates.filter(({ item }) =>
          isPackage ? centerX(item) < productSplitX : centerX(item) > productSplitX);
        if (half.length !== 3) throw new Error(`Expected three ${productName} cells at y=${baseline.y}.`);
        return { baseline, slab: slabItems[0]!, rates: half };
      });

      const columnCenters = [0, 1, 2].map((columnIndex) =>
        productRows.reduce((total, row) => total + centerX(row.rates[columnIndex]!.item), 0) /
        productRows.length);
      const intervals = columnCenters.map((center, index) => ({
        columnIndex: index + 1,
        center,
        left: index === 0 ? center - (columnCenters[1]! - center) / 2 :
          (columnCenters[index - 1]! + center) / 2,
        right: index === columnCenters.length - 1 ? center + (center - columnCenters[index - 1]!) / 2 :
          (center + columnCenters[index + 1]!) / 2,
      }));

      const localFuelHeaders = page.textItems
        .map((item, index) => ({ index, item }))
        .filter(({ item }) =>
          item.y < productHeading.item.y &&
          item.y > productRows[0]!.baseline.y &&
          /^(?:Petrol|Non\s*[-–]?\s*Petrol)$/i.test(item.text.trim()) &&
          (isPackage ? centerX(item) < productSplitX : centerX(item) > productSplitX));
      const localNcbHeaders = page.textItems
        .map((item, index) => ({ index, item }))
        .filter(({ item }) =>
          item.y < productHeading.item.y &&
          item.y > productRows[0]!.baseline.y &&
          /^(?:NCB\s*&\s*N-NCB|NCB|N-NCB)$/i.test(item.text.trim()) &&
          (isPackage ? centerX(item) < productSplitX : centerX(item) > productSplitX));
      if (localFuelHeaders.length !== 2 || localNcbHeaders.length !== 3) {
        throw new Error(`Header reconstruction failed for ${zoneBoundary.raw} / ${productName}.`);
      }

      const fuelHeaders = localFuelHeaders.map(({ index, item }) => ({
        rawText: item.text,
        source: locator(page.pageNumber, index),
        columnIndexes: overlapColumnIndexes(item, intervals),
      }));
      const ncbHeaders = localNcbHeaders.map(({ index, item }) => ({
        rawText: item.text,
        source: locator(page.pageNumber, index),
        columnIndexes: overlapColumnIndexes(item, intervals),
      }));

      const rateRows = productRows.map(({ baseline, slab, rates }) => ({
        slabLabelRaw: slab.item.text,
        slabInterpretationStatus: "SOURCE_LABEL_ONLY_ENDPOINT_SEMANTICS_NOT_ASSIGNED" as const,
        slabSource: itemRef(page.pageNumber, slab),
        baselineY: baseline.y,
        cells: rates.map(({ index, item }, columnOffset) => {
          const columnIndex = columnOffset + 1;
          const fuel = fuelHeaders.find((header) => header.columnIndexes.includes(columnIndex));
          const ncb = ncbHeaders.find((header) => header.columnIndexes.includes(columnIndex));
          if (!fuel || !ncb) {
            throw new Error(`Rate cell at y=${baseline.y}, column ${columnIndex} has incomplete header context.`);
          }
          return {
            columnIndex,
            rawDisplayText: item.text,
            ratePercent: item.text.slice(0, -1),
            source: locator(page.pageNumber, index),
            header: {
              columnIndex,
              fuelGroupRaw: fuel.rawText,
              fuelHeader: fuel.source,
              ncbGroupRaw: ncb.rawText,
              ncbHeader: ncb.source,
              columnCenterX: columnCenters[columnOffset]!,
            },
          };
        }),
      }));

      tables.push({
        tableId: `${zoneBoundary.zone}_${productName.toUpperCase()}`,
        pageNumber: 1,
        zone: zoneBoundary.zone,
        productCategoryRaw: productName,
        rateScope: isPackage ? "PACKAGE" : "OD_COMPONENT",
        zoneHeader: zoneHeaderRef,
        productHeader: itemRef(page.pageNumber, productHeading),
        categoryHeader: itemRef(page.pageNumber, zoneCategory[0]!),
        fuelHeaders,
        ncbHeaders,
        slabRows: rateRows,
      });
    }
  }
  return tables;
}

function buildGeographyRows(pages: PdfPage[]): HdfcErgoAdapterDraft["geographyRows"] {
  const result: HdfcErgoAdapterDraft["geographyRows"] = [];
  for (const page of pages) {
    const baselines = lineBaselines(page);
    const header = baselines.find((line) =>
      line.items.some(({ item }) => item.text === "State Name") &&
      line.items.some(({ item }) => item.text === "Zone-1") &&
      line.items.some(({ item }) => item.text === "Zone-2"));
    if (!header) throw new Error(`Geography table header not found on page ${page.pageNumber}.`);
    let regionContext: { value: string; source: TextLocator } | null = null;
    let stateContext: { value: string; source: TextLocator } | null = null;

    for (const baseline of baselines.filter((line) => line.y < header.y)) {
      const directItems = baseline.items;
      const regionItem = directItems.find(({ item }) => item.x < 150);
      const stateItem = directItems.find(({ item }) => item.x >= 150 && item.x < 260);
      const zone1Items = directItems.filter(({ item }) => item.x >= 260 && item.x < 400);
      const zone2Items = directItems.filter(({ item }) => item.x >= 400);
      if (regionItem) {
        regionContext = {
          value: regionItem.item.text,
          source: itemRef(page.pageNumber, regionItem),
        };
      }
      if (stateItem) {
        stateContext = {
          value: stateItem.item.text,
          source: itemRef(page.pageNumber, stateItem),
        };
      }
      if (!regionItem && !stateItem && zone1Items.length === 0 && zone2Items.length === 0) continue;

      const asCell = (entry: { index: number; item: PdfTextItem }) => ({
        value: entry.item.text,
        source: itemRef(page.pageNumber, entry),
      });
      result.push({
        pageNumber: page.pageNumber as 1 | 2,
        baselineY: baseline.y,
        region: regionItem ? asCell(regionItem) : null,
        state: stateItem ? asCell(stateItem) : null,
        regionContext: regionContext ? { ...regionContext } : null,
        stateContext: stateContext ? { ...stateContext } : null,
        zone1Areas: zone1Items.map(asCell),
        zone2Areas: zone2Items.map(asCell),
        sourceItems: directItems.map(({ index }) => locator(page.pageNumber, index)),
      });
    }
  }
  return result;
}

function buildGeographyTableHeaders(
  pages: PdfPage[],
): HdfcErgoAdapterDraft["geographyTableHeaders"] {
  return pages.map((page) => {
    const header = lineBaselines(page).find((line) =>
      line.items.some(({ item }) => item.text === "State Name") &&
      line.items.some(({ item }) => item.text === "Zone-1") &&
      line.items.some(({ item }) => item.text === "Zone-2"));
    if (!header) throw new Error(`Geography table header not found on page ${page.pageNumber}.`);
    const headerAt = (text: string) => {
      const match = header.items.find(({ item }) => item.text === text);
      if (!match) throw new Error(`Geography header "${text}" is missing on page ${page.pageNumber}.`);
      return itemRef(page.pageNumber, match);
    };
    return {
      pageNumber: page.pageNumber as 1 | 2,
      regionHeader: headerAt("Zone"),
      stateNameHeader: headerAt("State Name"),
      zone1Header: headerAt("Zone-1"),
      zone2Header: headerAt("Zone-2"),
    };
  });
}

function buildFootnotes(page: PdfPage): HdfcErgoAdapterDraft["footnotes"] {
  const patterns = [
    /Slab will be calculated basis comprehensive \+ SAOD GWP/i,
    /Non\s*-?\s*Petrol includes Diesel, CNG, LPG/i,
    /New Business will be considered as NCB/i,
    /EV and Hybrid is to be considered in Petrol Grid/i,
  ];
  return page.textItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => patterns.some((pattern) => pattern.test(item.text)))
    .map(({ item, index }) => ({
      rawText: item.text,
      source: locator(page.pageNumber, index),
    }));
}

function pageEvidence(page: PdfPage): HdfcErgoAdapterDraft["pages"][number] {
  return {
    pageNumber: page.pageNumber,
    width: page.width,
    height: page.height,
    coordinateSystem: "PDF_POINTS_ORIGIN_BOTTOM_LEFT",
    textItems: page.textItems.map((item, itemIndex) => ({
      itemIndex,
      locator: `page[${page.pageNumber}].textItems[${itemIndex}]`,
      text: item.text,
      boundingBox: {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      },
    })),
  };
}

function findCell(
  tables: HdfcErgoAdapterDraft["rateTables"],
  zone: "ZONE_1" | "ZONE_2",
  slabLabelRaw: string,
  product: "Package" | "SAOD",
  fuelRaw: string,
  ncbRaw: string,
) {
  const table = tables.find((candidate) =>
    candidate.zone === zone && candidate.productCategoryRaw === product);
  const row = table?.slabRows.find((candidate) => candidate.slabLabelRaw === slabLabelRaw);
  const cell = row?.cells.find((candidate) =>
    (fuelRaw === "Non-Petrol"
      ? candidate.header.fuelGroupRaw.startsWith("Non")
      : candidate.header.fuelGroupRaw === fuelRaw) &&
    candidate.header.ncbGroupRaw === ncbRaw);
  if (!cell || !row) {
    throw new Error(`Could not find candidate cell ${zone}/${product}/${slabLabelRaw}/${fuelRaw}/${ncbRaw}.`);
  }
  return { row, cell };
}

function buildSampleTrace(
  page1: PdfPage,
  tables: HdfcErgoAdapterDraft["rateTables"],
  geographyRows: HdfcErgoAdapterDraft["geographyRows"],
  lookupNote: { index: number; item: PdfTextItem },
  effectiveFrom: string,
): HdfcErgoAdapterDraft["sampleResolutionTrace"] {
  const haryana = geographyRows.find((row) =>
    row.state?.value.toLowerCase() === "haryana" ||
    row.stateContext?.value.toLowerCase() === "haryana");
  const haryanaZone2 = haryana?.zone2Areas.find((area) => area.value.toLowerCase() === "haryana");
  if (!haryanaZone2) throw new Error("Haryana → Zone 2 source mapping was not reconstructed.");

  const candidates = [
    findCell(tables, "ZONE_2", ">10-50k", "Package", "Petrol", "NCB & N-NCB"),
    findCell(tables, "ZONE_2", ">10-50k", "Package", "Non-Petrol", "NCB"),
  ].map(({ row, cell }) => ({
    ratePercent: cell.ratePercent,
    fuelGroupRaw: cell.header.fuelGroupRaw,
    ncbGroupRaw: cell.header.ncbGroupRaw,
    slabLabelRaw: row.slabLabelRaw,
    slabSource: row.slabSource,
    status: "CONDITIONAL_CANDIDATE_NOT_FINAL" as const,
    source: cell.source,
  }));
  return {
    samplePolicy: {
      sourceKind: "PHASE_0_RULEBOOK",
      sourceFile: phase0Rulebook,
      section: sampleSection,
      referencedPolicyFile: "sample-policies/pvt-car-comprehensive-hdfc-ergo.pdf",
      issueDate: "2026-03-26",
      registrationState: "Haryana",
      productDescription: "Private Car Comprehensive",
      currentNcbPercent: "35",
      netOwnDamagePremium: "8053",
      netLiabilityPremium: "3816",
      totalNetPackagePremium: "11869",
      gst: "2136",
      fuel: {
        policyStatus: "MISSING",
        unapprovedExternalCorroboration: "Diesel is externally corroborated in the rulebook, but no approved vehicle-master source is configured.",
        sourceKind: "EXTERNAL_REFERENCE_NOT_APPROVED",
      },
    },
    decisionStatus: "AMBIGUOUS",
    reasonCode: "FUEL_EVIDENCE_MISSING_OR_UNAPPROVED",
    selectedGridEffectiveFrom: effectiveFrom,
    anchorDate: "2026-03-26",
    rateScope: "PACKAGE",
    zone: "ZONE_2",
    productTable: "Package",
    gridLookupBasis: {
      rawText: lookupNote.item.text,
      source: locator(page1.pageNumber, lookupNote.index),
    },
    payoutBasis: {
      interpretation: "TOTAL_NET_PACKAGE_PREMIUM_OD_PLUS_TP_LIABILITY_EXCLUDING_GST",
      provenance: "PROJECT_OWNER_CLARIFICATION",
      source: {
        sourceKind: "PROJECT_OWNER_CLARIFICATION",
        file: phase0Rulebook,
        section: phase0Section,
      },
    },
    componentApplicability: {
      od: "NOT_SEPARATELY_SPECIFIED",
      tp: "NOT_SEPARATELY_SPECIFIED",
    },
    conditionalCandidates: candidates,
    finalRatePercent: null,
    finalPayoutAmount: null,
    withheldReason: "Fuel is required by the grid's Petrol/Non-Petrol header and is missing from policy evidence; the available Diesel corroboration is external and unapproved. Candidate values are conditional only and are not an approved or final commission rate.",
  };
}

export function normalizeHdfcErgoInventory(input: unknown): HdfcErgoAdapterDraft {
  const inventory = inventorySchema.parse(input);
  const matches = inventory.documents.filter((entry) => {
    if (typeof entry !== "object" || entry === null || !("source" in entry)) return false;
    const source = (entry as { source?: unknown }).source;
    return typeof source === "object" && source !== null &&
      "relativePath" in source && source.relativePath === hdfcGridPath;
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Phase 2A HDFC grid IR at "${hdfcGridPath}", found ${matches.length}.`);
  }
  const document: GridDocument = gridDocumentSchema.parse(matches[0]);
  const verification = inventory.manifestVerifications.find((entry) =>
    entry.relativePath === hdfcGridPath);
  if (!verification || verification.status !== "PASS") {
    throw new Error("The original HDFC PDF has no passing Phase 2A manifest verification.");
  }
  if (
    verification.listedSha256 !== document.source.sha256 ||
    verification.actualSha256 !== document.source.sha256 ||
    verification.listedByteSize !== document.source.byteSize ||
    verification.actualByteSize !== document.source.byteSize
  ) {
    throw new Error("HDFC Phase 2A source identity does not match the manifest verification record.");
  }
  if (document.source.relativePath !== hdfcGridPath || document.source.insurerId !== "HDFC_ERGO") {
    throw new Error("The located Phase 2A document is not the expected HDFC ERGO source.");
  }
  if (document.pdf.pages.length !== 2) {
    throw new Error(`Expected a two-page HDFC grid IR, found ${document.pdf.pages.length} pages.`);
  }
  const pages = [...document.pdf.pages].sort((a, b) => a.pageNumber - b.pageNumber);
  if (pages.some((page, index) => page.pageNumber !== index + 1)) {
    throw new Error("HDFC PDF IR page numbers are missing or non-sequential.");
  }
  const page1 = pages[0]!;
  const effectiveDate = parseEffectiveDate(page1);
  if (effectiveDate.value !== "2025-02-01" || !effectiveDate.source) {
    throw new Error("The source's printed effective date could not be verified as 2025-02-01.");
  }
  const tables = buildRateTables(page1);
  const geographyRows = buildGeographyRows(pages);
  const geographyTableHeaders = buildGeographyTableHeaders(pages);
  const footnotes = buildFootnotes(page1);
  if (footnotes.length !== 4) {
    throw new Error(`Expected four relevant source footnotes, reconstructed ${footnotes.length}.`);
  }
  const lookupNote = page1.textItems
    .map((item, index) => ({ item, index }))
    .find(({ item }) => /Slab will be calculated basis comprehensive \+ SAOD GWP/i.test(item.text));
  if (!lookupNote) throw new Error("Grid slab-selection note was not found.");

  const textItemCount = pages.reduce((count, page) => count + page.textItems.length, 0);
  const draft: HdfcErgoAdapterDraft = {
    adapterVersion: "0.1.0",
    sourceIdentity: {
      sourceId: document.source.sourceId,
      fileName: document.source.fileName,
      relativePath: document.source.relativePath,
      format: "PDF",
      sha256: document.source.sha256,
      byteSize: document.source.byteSize,
      phase2aEffectiveFrom: document.source.effectiveFrom,
      phase2aEffectiveTo: document.source.effectiveTo,
      phase2aEffectiveDateStatus: document.source.effectiveDateStatus,
    },
    sourceEffectiveDateText: effectiveDate,
    inventory: {
      pageCount: pages.length,
      textItemCount,
      pageTextItemCounts: pages.map((page) => ({
        pageNumber: page.pageNumber,
        count: page.textItems.length,
      })),
      rateTableCount: tables.length,
      rateSlabRowCount: tables.reduce((count, table) => count + table.slabRows.length, 0),
      rateCellCount: tables.reduce((count, table) =>
        count + table.slabRows.reduce((rowCount, row) => rowCount + row.cells.length, 0), 0),
      geographyRowCount: geographyRows.length,
      footnoteCount: footnotes.length,
      manifestVerification: {
        status: "PASS",
        listedSha256: verification.listedSha256!,
        actualSha256: verification.actualSha256!,
        listedByteSize: verification.listedByteSize!,
        actualByteSize: verification.actualByteSize!,
      },
    },
    layoutReconstruction: {
      method: "DETERMINISTIC_COORDINATE_BASELINE_AND_X_COLUMN_GROUPING",
      coordinateSystem: "PDF_POINTS_ORIGIN_BOTTOM_LEFT",
      baselineTolerancePoints: coordinateTolerance,
      limitations: [
        "Phase 2A IR preserves text items and bounding boxes but not PDF vector rules, fills, or native table objects; row/column associations are deterministic geometric reconstructions, not original PDF table metadata.",
        "PDF page 2 and the lower page-1 geography table use merged visual context; repeated state/region context is preserved with the source locator from the last directly printed label.",
        "No original spreadsheet-style row numbers exist for PDF tables; citations use page number, text-item index, exact text, and bounding box only.",
      ],
    },
    pages: pages.map(pageEvidence),
    rateTables: tables,
    geographyTableHeaders,
    geographyRows,
    footnotes,
    semanticBasis: {
      lookupSlabBasis: {
        rawText: lookupNote.item.text,
        source: locator(page1.pageNumber, lookupNote.index),
        meaning: "COMPREHENSIVE_PLUS_SAOD_GWP_EXCLUDING_SATP",
        provenance: "INSURER_GRID_PDF",
      },
      payoutBasis: {
        interpretation: "TOTAL_NET_PACKAGE_PREMIUM_OD_PLUS_TP_LIABILITY_EXCLUDING_GST",
        provenance: "PROJECT_OWNER_CLARIFICATION",
        source: {
          sourceKind: "PROJECT_OWNER_CLARIFICATION",
          file: phase0Rulebook,
          section: phase0Section,
        },
      },
    },
    sampleResolutionTrace: buildSampleTrace(
      page1,
      tables,
      geographyRows,
      lookupNote,
      effectiveDate.value,
    ),
    warnings: [
      {
        code: "PHASE2A_EFFECTIVE_DATE_NOT_NORMALIZED",
        message: "Phase 2A reports effectiveDateStatus UNKNOWN and null bounds; this adapter separately preserves the PDF's exact printed effective-date text and deterministic 2025-02-01 extraction.",
        source: effectiveDate.source,
      },
      {
        code: "SAMPLE_FUEL_MISSING_OR_UNAPPROVED",
        message: "The sample's fuel is not printed in its policy evidence; the external Diesel corroboration cited by Phase 0 is not an approved vehicle-master source.",
      },
      {
        code: "SAMPLE_FINAL_RATE_WITHHELD",
        message: "No final sample rate or payout is emitted. Conditional table values remain candidates only because a required fuel dimension is unresolved.",
      },
    ],
    noApprovedCommissionRulesEmitted: true,
  };
  return hdfcErgoAdapterDraftSchema.parse(draft);
}

export const hdfcGridRelativePath = hdfcGridPath;
