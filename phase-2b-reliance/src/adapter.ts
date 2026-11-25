import path from "node:path";
import {
  serializedGridDocumentSchema,
  type JsonValue,
  type SerializedGridCell,
  type SerializedGridDocument,
  type SerializedGridSheet,
} from "./phase-2a-ir.js";
import {
  cellEvidenceSchema,
  reliancePrivateCarAdapterDraftSchema,
  type ReliancePrivateCarAdapterDraft,
} from "./schema.js";
import { z } from "zod";

const sourcePath =
  "raters/reliance-indusind/feb-2026/Reliance Broking Premier  FEB 26 Grid.xlsx";
const sourceHash =
  "50cd340b3ea5917d4fc6d55e720c14405f26d5076c059414b69a6c03ea7b3142";
const sourceByteSize = 1_928_494;
const expectedSheets = [
  "FEB'26 - Grid",
  "TW SCOOTER GRID",
  "PRIVATE CAR COMP, SAOD & STP",
  "Short Term Taxi",
  "Enabler, PO Guidelines & T&C",
  "Contest",
  "RTO List",
  "Make Model wise segment",
] as const;
const expectedDimensions: Record<string, string> = {
  "FEB'26 - Grid": "A1:AU76",
  "TW SCOOTER GRID": "A1:AA16",
  "PRIVATE CAR COMP, SAOD & STP": "A1:Q17",
  "Short Term Taxi": "A1",
  "Enabler, PO Guidelines & T&C": "A3:J62",
  Contest: "A1",
  "RTO List": "A1:E1502",
  "Make Model wise segment": "A1:C536",
};

const sheetScope = {
  "FEB'26 - Grid": {
    scope: "MASTER_INDEX",
    rationale: "Master grid was inspected; PC STP cells are retained raw and are not promoted to approved rates.",
    relevantRanges: ["A1:AU76", "AR2:AT76"],
  },
  "TW SCOOTER GRID": {
    scope: "OUT_OF_SCOPE",
    rationale: "Two-wheeler rates are outside the private-car adapter scope.",
    relevantRanges: ["A1:AA16"],
  },
  "PRIVATE CAR COMP, SAOD & STP": {
    scope: "PRIVATE_CAR_MATRIX",
    rationale: "Primary private-car matrix and H2:H6 payout terms.",
    relevantRanges: ["A1:F17", "H2:H6"],
  },
  "Short Term Taxi": {
    scope: "OUT_OF_SCOPE",
    rationale: "Empty taxi sheet; retained in workbook inventory.",
    relevantRanges: ["A1"],
  },
  "Enabler, PO Guidelines & T&C": {
    scope: "TERMS",
    rationale: "All guideline rows are retained as source observations; applicability is not inferred.",
    relevantRanges: ["A3:J62"],
  },
  Contest: {
    scope: "OUT_OF_SCOPE",
    rationale: "Empty contest sheet; retained in workbook inventory.",
    relevantRanges: ["A1"],
  },
  "RTO List": {
    scope: "RTO_MAP",
    rationale: "Complete RTO lookup table with region, market type, and zone.",
    relevantRanges: ["A1:E1502"],
  },
  "Make Model wise segment": {
    scope: "MAKE_MODEL_MAP",
    rationale: "Complete make/model segment map; segment is not a visible base-rate dimension.",
    relevantRanges: ["A1:C536"],
  },
} as const;

const samplePolicyFile = "sample-policies/pvt-car-comprehensive-reliance.pdf";
const relianceRulebook = "docs/phase-0/reliance-rulebook.md";

function columnNumber(column: string): number {
  let value = 0;
  for (const char of column) value = value * 26 + char.charCodeAt(0) - 64;
  return value;
}

function columnName(number: number): string {
  let current = number;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function splitAddress(address: string): { column: string; row: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (!match) throw new Error(`Invalid Excel cell address in Phase 2A IR: ${address}`);
  return { column: match[1]!, row: Number(match[2]) };
}

function parseRange(range: string): {
  startColumn: number;
  endColumn: number;
  startRow: number;
  endRow: number;
} {
  const [start, end = start] = range.split(":");
  if (!start || !end) throw new Error(`Invalid merged range in Phase 2A IR: ${range}`);
  const first = splitAddress(start);
  const last = splitAddress(end);
  return {
    startColumn: columnNumber(first.column),
    endColumn: columnNumber(last.column),
    startRow: first.row,
    endRow: last.row,
  };
}

function mergedRangeContaining(sheet: SerializedGridSheet, address: string): string | null {
  const cell = splitAddress(address);
  return sheet.mergedRanges.find((range) => {
    const parsed = parseRange(range);
    return cell.column && cell.row >= parsed.startRow && cell.row <= parsed.endRow &&
      columnNumber(cell.column) >= parsed.startColumn &&
      columnNumber(cell.column) <= parsed.endColumn;
  }) ?? null;
}

function mergedAnchor(range: string): string {
  return range.split(":")[0]!;
}

function makeCellIndex(sheet: SerializedGridSheet): Map<string, SerializedGridCell> {
  return new Map(sheet.cells.map((cell) => [cell.address, cell]));
}

function rawString(value: JsonValue | undefined): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function cellEvidence(
  sheet: SerializedGridSheet,
  index: Map<string, SerializedGridCell>,
  address: string,
) {
  const cell = index.get(address);
  let cachedValue: JsonValue | null = cell?.cachedValue ?? null;
  if (cell?.formula && cachedValue === null &&
      typeof cell.rawValue === "object" && cell.rawValue !== null &&
      !Array.isArray(cell.rawValue) && "result" in cell.rawValue) {
    cachedValue = cell.rawValue.result;
  }
  return cellEvidenceSchema.parse({
    source: { sheet: sheet.name, cell: address },
    rawValue: cell?.rawValue ?? null,
    formula: cell?.formula ?? null,
    cachedValue,
    errorCode: cell?.errorCode ?? null,
    numberFormat: cell?.numberFormat ?? null,
  });
}

function cellAt(
  sheet: SerializedGridSheet,
  index: Map<string, SerializedGridCell>,
  column: string,
  row: number,
) {
  return index.get(`${column}${row}`);
}

function populatedRows(sheet: SerializedGridSheet, columns: string[], firstRow: number): number[] {
  const result = new Set<number>();
  for (const cell of sheet.cells) {
    const { column, row } = splitAddress(cell.address);
    if (row >= firstRow && columns.includes(column)) result.add(row);
  }
  return [...result].sort((a, b) => a - b);
}

function normalizeCode(raw: string | null): string | null {
  return raw === null ? null : raw.toUpperCase().replace(/[\s-]+/g, "");
}

function normalizeName(raw: string | null): string | null {
  return raw === null ? null : raw.trim().toUpperCase().replace(/\s+/g, " ");
}

function mappingStatuses<T>(
  rows: T[],
  keyOf: (row: T) => string | null,
  signatureOf: (row: T) => string,
): Array<{ status: "UNIQUE" | "DUPLICATE_CONSISTENT" | "CONFLICTING"; conflictingRows: number[] }> {
  const grouped = new Map<string, Array<{ value: T; index: number }>>();
  rows.forEach((value, index) => {
    const key = keyOf(value);
    if (key === null) return;
    const group = grouped.get(key) ?? [];
    group.push({ value, index });
    grouped.set(key, group);
  });
  return rows.map((value, index) => {
    const key = keyOf(value);
    const matches = key === null ? [] : grouped.get(key) ?? [];
    if (matches.length <= 1) return { status: "UNIQUE", conflictingRows: [] };
    const distinct = new Set(matches.map(({ value: match }) => signatureOf(match)));
    return {
      status: distinct.size > 1 ? "CONFLICTING" : "DUPLICATE_CONSISTENT",
      conflictingRows: matches.filter((match) => match.index !== index)
        .map((match) => (match.value as { sourceRow: number }).sourceRow),
    };
  });
}

function buildRtoMappings(sheet: SerializedGridSheet) {
  const index = makeCellIndex(sheet);
  const rows = populatedRows(sheet, ["A", "B", "C", "D", "E"], 2).map((row) => {
    const registrationPrefix = cellEvidence(sheet, index, `A${row}`);
    const comparisonKey = cellEvidence(sheet, index, `B${row}`);
    const regionCity = cellEvidence(sheet, index, `C${row}`);
    const marketType = cellEvidence(sheet, index, `D${row}`);
    const zone = cellEvidence(sheet, index, `E${row}`);
    const rawRegistrationPrefix = rawString(registrationPrefix.rawValue);
    return {
      sourceRow: row,
      rawRegistrationPrefix,
      normalizedRegistrationPrefix: normalizeCode(
        rawString(comparisonKey.rawValue) ?? rawRegistrationPrefix,
      ),
      regionCity: rawString(regionCity.rawValue),
      marketType: rawString(marketType.rawValue),
      zone: rawString(zone.rawValue),
      sourceCells: { registrationPrefix, comparisonKey, regionCity, marketType, zone },
      status: "UNIQUE" as const,
      conflictingRows: [],
    };
  });
  const statuses = mappingStatuses(
    rows,
    (row) => row.normalizedRegistrationPrefix,
    (row) => JSON.stringify([row.regionCity, row.marketType, row.zone]),
  );
  return rows.map((row, index) => ({
    ...row,
    status: statuses[index]!.status,
    conflictingRows: statuses[index]!.conflictingRows,
  }));
}

function buildMakeModelMappings(sheet: SerializedGridSheet) {
  const index = makeCellIndex(sheet);
  const rows = populatedRows(sheet, ["A", "B", "C"], 2).map((row) => {
    const make = cellEvidence(sheet, index, `A${row}`);
    const model = cellEvidence(sheet, index, `B${row}`);
    const segment = cellEvidence(sheet, index, `C${row}`);
    const rawMake = rawString(make.rawValue);
    const rawModel = rawString(model.rawValue);
    return {
      sourceRow: row,
      rawMake,
      normalizedMake: normalizeName(rawMake),
      rawModel,
      normalizedModel: normalizeName(rawModel),
      segment: rawString(segment.rawValue),
      segmentUsedByRateMatrix: false as const,
      sourceCells: { make, model, segment },
      status: "UNIQUE" as const,
      conflictingRows: [],
    };
  });
  const statuses = mappingStatuses(
    rows,
    (row) => row.normalizedMake === null || row.normalizedModel === null
      ? null
      : `${row.normalizedMake}|${row.normalizedModel}`,
    (row) => JSON.stringify(row.segment),
  );
  return rows.map((row, index) => ({
    ...row,
    status: statuses[index]!.status,
    conflictingRows: statuses[index]!.conflictingRows,
  }));
}

const productColumns = [
  { column: "C", product: "PETROL_BIFUEL_COMPREHENSIVE", header: "Petrol/Bifuel/Comp" },
  { column: "D", product: "DIESEL_EV_COMPREHENSIVE", header: "Diesel/EV/Comp" },
  { column: "E", product: "STANDALONE_OD", header: "SA OD" },
  { column: "F", product: "STANDALONE_TP", header: "STP" },
] as const;

function headerContext(
  sheet: SerializedGridSheet,
  index: Map<string, SerializedGridCell>,
  column: string,
  row: number,
) {
  const columnHeaderAddress = `${column}2`;
  const columnHeaderValue = rawString(cellAt(sheet, index, column, 2)?.rawValue);
  const topTitleAddress = "A1";
  const topTitleRange = mergedRangeContaining(sheet, topTitleAddress);
  const titleAnchor = topTitleRange ? mergedAnchor(topTitleRange) : topTitleAddress;
  const titleCell = index.get(titleAnchor);
  const zoneRange = mergedRangeContaining(sheet, `A${row}`);
  const zoneAnchor = zoneRange ? mergedAnchor(zoneRange) : `A${row}`;
  const zoneCell = index.get(zoneAnchor);
  const title = {
    label: rawString(titleCell?.rawValue),
    source: { sheet: sheet.name, cell: titleAnchor },
    mergedRange: topTitleRange,
  };
  const colHeader = {
    label: columnHeaderValue,
    source: { sheet: sheet.name, cell: columnHeaderAddress },
    mergedRange: mergedRangeContaining(sheet, columnHeaderAddress),
  };
  return {
    title,
    colHeader,
    zone: {
      label: rawString(zoneCell?.rawValue) ?? rawString(cellAt(sheet, index, "A", row)?.rawValue),
      source: { sheet: sheet.name, cell: zoneAnchor },
      mergedRange: zoneRange,
    },
  };
}

function buildBaseGridRows(sheet: SerializedGridSheet) {
  const index = makeCellIndex(sheet);
  const rows = populatedRows(sheet, ["A", "B", "C", "D", "E", "F"], 3);
  return rows.map((row) => {
    const zoneEvidence = cellEvidence(sheet, index, `A${row}`);
    const regionEvidence = cellEvidence(sheet, index, `B${row}`);
    const zoneRange = mergedRangeContaining(sheet, `A${row}`);
    const zoneAnchor = zoneRange ? mergedAnchor(zoneRange) : `A${row}`;
    const zoneAnchorValue = cellAt(sheet, index, ...(() => {
      const { column, row: anchorRow } = splitAddress(zoneAnchor);
      return [column, anchorRow] as const;
    })());
    const products = productColumns.map(({ column, product }) => {
      const evidence = cellEvidence(sheet, index, `${column}${row}`);
      const rawValue = evidence.rawValue;
      const rawDecimalString = typeof rawValue === "number"
        ? String(rawValue)
        : typeof rawValue === "string" && rawValue.trim() !== ""
          ? rawValue.trim()
          : null;
      const header = headerContext(sheet, index, column, row);
      return {
        product,
        rawValue,
        rawDecimalString,
        numberFormat: evidence.numberFormat,
        source: evidence.source,
        evidence,
        header: {
          label: header.colHeader.label,
          source: header.colHeader.source,
          mergedRange: header.colHeader.mergedRange,
          ancestry: [
            header.title,
            header.zone,
          ],
        },
        eligibility: "CONDITIONAL_CANDIDATE_ONLY" as const,
      };
    });
    return {
      sourceRow: row,
      zone: rawString(zoneEvidence.rawValue),
      regionCity: rawString(regionEvidence.rawValue),
      zoneEvidence,
      regionEvidence,
      mergedZoneGroup: {
        range: zoneRange,
        anchor: { sheet: sheet.name, cell: zoneAnchor },
        label: rawString(zoneAnchorValue?.rawValue) ?? rawString(zoneEvidence.rawValue),
      },
      products,
      sourceRange: { sheet: sheet.name, range: `A${row}:F${row}` },
    };
  });
}

function buildTerms(sheet: SerializedGridSheet) {
  const index = makeCellIndex(sheet);
  const rawTerms = [
    {
      termType: "PAYOUT_BASIS" as const,
      address: "H2",
      basis: "OD_PREMIUM" as const,
      operation: "USE_AS_PAYOUT_BASIS" as const,
      condition: null,
      unresolvedSemantics: [],
      interpretationProvenance: "INSURER_GRID" as const,
    },
    {
      termType: "RELATIVE_ADJUSTMENT" as const,
      address: "H3",
      operation: "MULTIPLY_RATE" as const,
      factor: "0.95" as const,
      condition: { engineCapacityCc: { lt: 1000 as const } },
      unresolvedSemantics: [],
      interpretationProvenance: "PROJECT_OWNER_CLARIFICATION" as const,
      clarificationDate: "2026-11-23" as const,
    },
    {
      termType: "UNRESOLVED_ADJUSTMENT" as const,
      address: "H4",
      candidateValue: "2.5",
      condition: "Standalone ZD policy",
      operation: null,
      basis: null,
      unresolvedSemantics: ["relative versus percentage-point reduction", "applicable payout basis"],
      interpretationProvenance: "INSURER_GRID_UNRESOLVED" as const,
    },
    {
      termType: "CONDITIONAL_FLAT_PAYOUT" as const,
      address: "H5",
      candidateValue: "20" as const,
      condition: "Extended Warranty",
      operation: null,
      basis: null,
      unresolvedSemantics: ["payout basis", "operation", "eligibility conditions"],
      interpretationProvenance: "INSURER_GRID_UNRESOLVED" as const,
    },
    {
      termType: "INCREMENTAL_PAYOUT" as const,
      address: "H6",
      candidateValue: "2.5" as const,
      condition: "Tyre/RTI bundle is sourced",
      operation: null,
      basis: null,
      unresolvedSemantics: ["payout basis", "operation", "sourcing evidence requirements"],
      interpretationProvenance: "INSURER_GRID_UNRESOLVED" as const,
    },
  ];
  return rawTerms.map((term) => {
    const evidence = cellEvidence(sheet, index, term.address);
    const rawWording = rawString(evidence.rawValue);
    if (rawWording === null) {
      throw new Error(`Required Reliance term source cell is empty: ${sheet.name}!${term.address}`);
    }
    const { address: _address, ...normalizedTerm } = term;
    return { ...normalizedTerm, rawWording, source: evidence.source, evidence };
  });
}

function buildContextualObservations(sheet: SerializedGridSheet) {
  const index = makeCellIndex(sheet);
  const rows = populatedRows(sheet, ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"], 3);
  let section: string | null = null;
  return rows.map((row) => {
    const rowCells = sheet.cells.filter((cell) => splitAddress(cell.address).row === row)
      .sort((a, b) => columnNumber(splitAddress(a.address).column) - columnNumber(splitAddress(b.address).column));
    const rowText = rowCells.map((cell) => rawString(cell.rawValue) ?? "").filter(Boolean);
    const heading = rowText.find((text) =>
      /guideline|hygiene|synergy|school bus|volume slab/i.test(text),
    );
    if (heading) section = heading;
    return {
      row,
      section,
      scopeStatus: "UNRESOLVED_SCOPE_NOT_APPLIED" as const,
      cells: rowCells.map((cell) => cellEvidence(sheet, index, cell.address)),
    };
  });
}

function buildWorkbookInventory(document: SerializedGridDocument) {
  const sheets = document.workbook!.sheets;
  if (sheets.length !== expectedSheets.length ||
      sheets.some((sheet, index) => sheet.name !== expectedSheets[index])) {
    throw new Error(
      `Unexpected Reliance workbook sheets: ${sheets.map((sheet) => sheet.name).join(" | ")}`,
    );
  }
  const sheetInventory = sheets.map((sheet) => {
    const scope = sheetScope[sheet.name as keyof typeof sheetScope];
    if (!scope) throw new Error(`No adapter classification exists for sheet "${sheet.name}".`);
    const formulaCells = sheet.cells.filter((cell) => cell.formula !== undefined);
    const formulaErrorCells = sheet.cells.filter((cell) => cell.errorCode !== undefined);
    return {
      name: sheet.name,
      order: sheet.order,
      visibility: sheet.visibility,
      dimension: sheet.dimension,
      expectedSourceDimension: expectedDimensions[sheet.name] ?? null,
      dimensionMatchesExpected: sheet.dimension === null
        ? null
        : sheet.dimension === expectedDimensions[sheet.name],
      actualRowCount: sheet.actualRowCount,
      actualColumnCount: sheet.actualColumnCount,
      mergedRanges: sheet.mergedRanges,
      nonEmptyCellCount: sheet.cells.length,
      formulaCount: formulaCells.length,
      formulaErrorCount: formulaErrorCells.length,
      formulaCells: formulaCells.map((cell) => cellEvidence(sheet, makeCellIndex(sheet), cell.address)),
      formulaErrorCells: formulaErrorCells.map((cell) => cellEvidence(sheet, makeCellIndex(sheet), cell.address)),
      isEmpty: sheet.cells.length === 0,
      scope: scope.scope,
      rationale: scope.rationale,
      relevantRanges: scope.relevantRanges.map((range) => ({ sheet: sheet.name, range })),
    };
  });
  const masterSheet = sheets.find((sheet) => sheet.name === "FEB'26 - Grid")!;
  const termsSheet = sheets.find((sheet) => sheet.name === "Enabler, PO Guidelines & T&C")!;
  const privateCarSheet = sheets.find((sheet) => sheet.name === "PRIVATE CAR COMP, SAOD & STP")!;
  return {
    sheets: sheetInventory,
    masterGridRawCells: masterSheet.cells.map((cell) =>
      cellEvidence(masterSheet, makeCellIndex(masterSheet), cell.address),
    ),
    contextualObservations: buildContextualObservations(termsSheet),
    privateCarMatrixMergedRanges: privateCarSheet.mergedRanges,
    privateCarHeaderReconstruction: "RECONSTRUCTED_FROM_PHASE_2A_CELL_VALUES_AND_MERGED_RANGES" as const,
  };
}

function fact(
  rawValue: JsonValue,
  normalizedValue: JsonValue,
  status: "PRESENT" | "MISSING" | "INVALID" | "AMBIGUOUS" | "UNVERIFIED",
  page: number | null,
  note: string | null,
  sourceKind: "POLICY_PDF" | "INSURER_GRID" | "PROJECT_OWNER_CLARIFICATION" = "POLICY_PDF",
) {
  return {
    rawValue,
    normalizedValue,
    status,
    evidence: [{
      sourceKind,
      file: sourceKind === "POLICY_PDF" ? samplePolicyFile :
        sourceKind === "INSURER_GRID" ? sourcePath : "project-owner-clarification",
      page,
      sheet: sourceKind === "INSURER_GRID" ? "PRIVATE CAR COMP, SAOD & STP" : null,
      cell: null,
      section: sourceKind === "PROJECT_OWNER_CLARIFICATION" ? "Grid date anchor clarification (2026-11-23)" : null,
    }],
    note,
  };
}

function sourceRowsToTrace(
  baseGridRows: ReturnType<typeof buildBaseGridRows>,
  rtoMappings: ReturnType<typeof buildRtoMappings>,
  makeModelMappings: ReturnType<typeof buildMakeModelMappings>,
  terms: ReturnType<typeof buildTerms>,
) {
  const rto = rtoMappings.filter((mapping) => mapping.normalizedRegistrationPrefix === "UP16");
  const makeModel = makeModelMappings.filter(
    (mapping) => mapping.normalizedMake === "RENAULT" && mapping.normalizedModel === "KWID",
  );
  const candidateRows = baseGridRows.filter((row) =>
    row.zone?.trim().toUpperCase() === "NORTH" &&
    row.regionCity?.trim().toUpperCase() === "DELHI",
  );
  const candidate = candidateRows.length === 1 ? candidateRows[0] : undefined;
  const candidateProducts = candidate?.products.map((product) => ({
    product: product.product,
    rawValue: product.rawValue,
    rateString: product.rawDecimalString,
    source: product.source,
    status: "NON_FINAL_CONDITIONAL_CANDIDATE" as const,
  })) ?? [];
  const relativeAdjustment = terms.find((term) => term.termType === "RELATIVE_ADJUSTMENT");
  if (!relativeAdjustment || relativeAdjustment.termType !== "RELATIVE_ADJUSTMENT") {
    throw new Error("Reliance <1000 CC relative adjustment was not normalized.");
  }
  const mappingStatus = (rows: Array<{ status: "UNIQUE" | "DUPLICATE_CONSISTENT" | "CONFLICTING" }>) => {
    if (rows.length === 0) return "MISSING" as const;
    if (rows.length > 1 || rows.some((row) => row.status === "CONFLICTING")) return "AMBIGUOUS" as const;
    return "UNIQUE" as const;
  };
  return {
    status: "UNSUPPORTED" as const,
    reasonCode: "NO_TEMPORALLY_APPLICABLE_GRID" as const,
    policyIssueDate: fact("12-Dec-2025 06:00", "2025-12-12", "PRESENT", 2, null),
    dateAnchor: {
      kind: "POLICY_ISSUE_DATE" as const,
      resolvedDate: "2025-12-12" as const,
      selectionRationale: "Policy issue date is the default anchor; no authoritative Reliance login-date instruction or retrospective authorization is supplied.",
      evidence: [
        fact("12-Dec-2025 06:00", "2025-12-12", "PRESENT", 2, null).evidence[0]!,
        fact(
          "Use issue date unless an insurer instruction defines another anchor",
          "POLICY_ISSUE_DATE",
          "PRESENT",
          null,
          null,
          "PROJECT_OWNER_CLARIFICATION",
        ).evidence[0]!,
      ],
    },
    gridApplicability: "NOT_COVERED_FROM_AVAILABLE_EVIDENCE" as const,
    latestGridFallbackUsed: false as const,
    policyFacts: {
      currentInsurer: fact("Reliance General Insurance", "RELIANCE_INDUSIND", "PRESENT", 2, null),
      proposalBusinessWording: fact("Renewal of Policy", "RENEWAL", "PRESENT", 9, null),
      previousInsurer: fact(null, null, "MISSING", 9, "Not identified; not inferred from current insurer."),
      existingRelianceCustomer: fact("No", "NO", "PRESENT", 9, "Separate checkbox; not evidence of previous insurer."),
      policyIssueDate: fact("12-Dec-2025 06:00", "2025-12-12", "PRESENT", 2, null),
      policyPeriod: fact("23-Dec-2025 to 22-Dec-2026", ["2025-12-23", "2026-12-22"], "PRESENT", 2, null),
      vehicle: fact("Renault Kwid 1.0 RXT O", "RENAULT KWID 1.0 RXT O", "PRESENT", 2, null),
      registrationNumber: fact("UP-16", "UP16", "PRESENT", 2, null),
      engineCapacityCc: fact("999 CC", "999", "PRESENT", 2, null),
      fuel: fact(null, null, "UNVERIFIED", 2, "Fuel is not printed; no approved external vehicle-master evidence supplied."),
      manufactureMonthYear: fact("Oct-2020", "2020-10", "PRESENT", 2, null),
      ncbDeduction: fact("25%", "25", "PRESENT", 2, null),
      totalOdPremium: fact("4714.00", "4714.00", "PRESENT", 2, null),
      totalBasicLiabilityPremium: fact("2094.00", "2094.00", "PRESENT", 2, null),
      paBenefitsPremium: fact("375.00", "375.00", "PRESENT", 2, null),
      legalLiabilityPremium: fact("50.00", "50.00", "PRESENT", 2, null),
      totalLiabilityPremium: fact("2519.00", "2519.00", "PRESENT", 2, null),
      totalPackagePremium: fact("7233.00", "7233.00", "PRESENT", 2, null),
      gst: fact("1302.00", "1302.00", "PRESENT", 2, null),
    },
    mappingOutcomes: {
      rto: mappingStatus(rto),
      makeModel: mappingStatus(makeModel),
    },
    rtoMappingCandidates: rto,
    makeModelMappingCandidates: makeModel,
    candidate: {
      sourceRow: candidate?.sourceRow ?? null,
      sourceRange: candidate ? `A${candidate.sourceRow}:F${candidate.sourceRow}` : null,
      rates: candidateProducts,
      relativeAdjustmentFactor: relativeAdjustment.factor,
      adjustmentConditionSatisfied: 999 < 1000,
    },
    finalCommissionRate: null,
    finalPayoutAmount: null,
    approvedCommissionRuleCount: 0 as const,
  };
}

export function normalizeReliancePrivateCar(
  documentInput: SerializedGridDocument,
  verification: {
    relativePath: string;
    listedSha256: string | null;
    actualSha256: string | null;
    listedByteSize: number | null;
    actualByteSize: number | null;
    status: "PASS" | "FAIL";
  },
): ReliancePrivateCarAdapterDraft {
  const document = serializedGridDocumentSchema.parse(documentInput);
  if (document.source.relativePath !== sourcePath ||
      document.source.fileName !== path.posix.basename(sourcePath) ||
      document.source.insurerId !== "RELIANCE_INDUSIND" ||
      document.source.format !== "XLSX") {
    throw new Error(`Unexpected Reliance source identity: ${document.source.relativePath}.`);
  }
  if (document.source.sha256 !== sourceHash || document.source.byteSize !== sourceByteSize) {
    throw new Error(`Reliance source identity/hash/byte count does not match the approved source manifest.`);
  }
  if (verification.relativePath !== sourcePath || verification.status !== "PASS" ||
      verification.listedSha256 !== sourceHash || verification.actualSha256 !== sourceHash ||
      verification.listedByteSize !== sourceByteSize || verification.actualByteSize !== sourceByteSize) {
    throw new Error("Reliance manifest verification did not pass exact path, SHA-256, and byte-size checks.");
  }
  const blockers = document.warnings.filter((warning) => warning.severity === "BLOCKER");
  if (blockers.length > 0) {
    throw new Error(`Phase 2A parser blockers: ${blockers.map((warning) => warning.code).join(", ")}.`);
  }
  if (!document.workbook) throw new Error("Reliance Phase 2A document has no workbook IR.");

  const sheetsByName = new Map(document.workbook.sheets.map((sheet) => [sheet.name, sheet]));
  const getSheet = (name: string) => {
    const sheet = sheetsByName.get(name);
    if (!sheet) throw new Error(`Required Reliance workbook sheet is missing: "${name}".`);
    return sheet;
  };
  const privateCarSheet = getSheet("PRIVATE CAR COMP, SAOD & STP");
  const rtoSheet = getSheet("RTO List");
  const modelSheet = getSheet("Make Model wise segment");
  const termIndex = makeCellIndex(privateCarSheet);
  const expectedHeaders = ["Zone", "RTO region", "Petrol/Bifuel/Comp", "Diesel/EV/Comp", "SA OD", "STP"];
  const actualHeaders = ["A", "B", "C", "D", "E", "F"].map((column) =>
    rawString(cellAt(privateCarSheet, termIndex, column, 2)?.rawValue),
  );
  if (actualHeaders.some((value, index) => value !== expectedHeaders[index])) {
    throw new Error(`Unexpected Reliance private-car matrix headers: ${actualHeaders.join(" | ")}`);
  }

  const workbookInventory = buildWorkbookInventory(document);
  const rtoMappings = buildRtoMappings(rtoSheet);
  const makeModelMappings = buildMakeModelMappings(modelSheet);
  const baseGridRows = buildBaseGridRows(privateCarSheet);
  const termsAndAdjustments = buildTerms(privateCarSheet);
  const sampleResolutionTrace = sourceRowsToTrace(
    baseGridRows,
    rtoMappings,
    makeModelMappings,
    termsAndAdjustments,
  );
  const formulaCells = workbookInventory.sheets.flatMap((sheet) => sheet.formulaCells);
  const formulaErrorCells = workbookInventory.sheets.flatMap((sheet) => sheet.formulaErrorCells);
  const dimensionMismatches = workbookInventory.sheets
    .filter((sheet) => sheet.dimensionMatchesExpected === false)
    .map((sheet) => sheet.name);
  const warnings = [
    {
      code: "EFFECTIVE_BOUNDS_UNKNOWN" as const,
      message: "The FEB 26 filename label and Jan-26 sheet title do not establish precise effective dates.",
      source: { sheet: privateCarSheet.name, cell: "A1" },
      affectedSheets: [privateCarSheet.name],
    },
    {
      code: "POLICY_FUEL_UNVERIFIED" as const,
      message: "Fuel is not stated on the policy schedule and no approved external vehicle-master source was supplied.",
      source: null,
      affectedSheets: [],
    },
    {
      code: "PREVIOUS_INSURER_MISSING" as const,
      message: "Previous insurer is not identified in the inspected policy pages and is not inferred.",
      source: null,
      affectedSheets: [],
    },
    {
      code: "SMALL_SEGMENT_NOT_A_RATE_DIMENSION" as const,
      message: "SMALL is retained in the make/model mapping but is not a visible private-car matrix column.",
      source: { sheet: modelSheet.name, cell: "C397" },
      affectedSheets: [modelSheet.name, privateCarSheet.name],
    },
    {
      code: "UNRESOLVED_ADJUSTMENT_TERMS" as const,
      message: "H4, H5, and H6 remain conditional/unresolved and are not applied.",
      source: { sheet: privateCarSheet.name, cell: "H4" },
      affectedSheets: [privateCarSheet.name],
    },
    {
      code: "MASTER_GRID_PRIVATE_CAR_STP_ZERO_UNINTERPRETED" as const,
      message: "The separate PC STP Non-Diesel area contains explicit zero values; they are preserved raw and not interpreted as a commission rule or decline.",
      source: { sheet: "FEB'26 - Grid", cell: "AR5" },
      affectedSheets: ["FEB'26 - Grid"],
    },
    {
      code: "ENABLER_SCOPE_UNRESOLVED" as const,
      message: "Enabler, hygiene, and synergy rows are retained with citations but their private-car applicability is not inferred or applied.",
      source: { sheet: "Enabler, PO Guidelines & T&C", cell: "A3" },
      affectedSheets: ["Enabler, PO Guidelines & T&C"],
    },
    ...(dimensionMismatches.length > 0 ? [{
      code: "PHASE_2A_DIMENSION_DIFFERS_FROM_SOURCE_EXPECTATION" as const,
      message: `Phase 2A dimension metadata differs from source inspection expectations: ${dimensionMismatches.join(", ")}. Observed values are retained without rewriting the IR.`,
      source: null,
      affectedSheets: dimensionMismatches,
    }] : []),
  ];
  const sourceIdentity = {
    insurerId: "RELIANCE_INDUSIND" as const,
    fileName: document.source.fileName,
    relativePath: document.source.relativePath,
    sha256: document.source.sha256,
    byteSize: document.source.byteSize,
    workbookPeriodLabel: { value: "FEB 26" as const, provenance: "FILENAME_LABEL_ONLY" as const },
    privateCarSheetTitle: rawString(cellAt(privateCarSheet, termIndex, "A", 1)?.rawValue) ?? "",
    privateCarSheetPeriodLabel: { value: "Jan-26" as const, provenance: "SHEET_TITLE_LABEL_ONLY" as const },
    effectiveFrom: null,
    effectiveTo: null,
    effectiveDateStatus: "UNKNOWN_OR_UNVERIFIED" as const,
    manifestPath: "data/source-corpus/MANIFEST.json" as const,
  };
  if (!sourceIdentity.privateCarSheetTitle.includes("Jan-26")) {
    throw new Error(
      `Unexpected Reliance private-car sheet period label: ${sourceIdentity.privateCarSheetTitle}`,
    );
  }
  const draft = {
    adapterVersion: "2B-RELIANCE-PRIVATE-CAR-1.0.0" as const,
    sourceIdentity,
    workbookInventory,
    rtoMappings,
    makeModelMappings,
    baseGridRows,
    termsAndAdjustments,
    sampleResolutionTrace,
    warnings,
    validationSummary: {
      workbookSheetCount: workbookInventory.sheets.length,
      rtoMappingCount: rtoMappings.length,
      makeModelMappingCount: makeModelMappings.length,
      baseGridRowCount: baseGridRows.length,
      termCount: termsAndAdjustments.length,
      masterGridRawCellCount: workbookInventory.masterGridRawCells.length,
      contextualObservationCount: workbookInventory.contextualObservations.length,
      workbookFormulaCount: formulaCells.length,
      workbookFormulaErrorCount: formulaErrorCells.length,
      approvedCommissionRuleCount: 0 as const,
    },
    approvedCommissionRules: [],
  };
  return reliancePrivateCarAdapterDraftSchema.parse(draft);
}

export function inventoryDocumentForReliance(input: unknown): {
  document: SerializedGridDocument;
  verification: {
    relativePath: string;
    listedSha256: string | null;
    actualSha256: string | null;
    listedByteSize: number | null;
    actualByteSize: number | null;
    status: "PASS" | "FAIL";
  };
} {
  const inventory = z.object({
    documents: z.array(z.unknown()),
    manifestVerifications: z.array(z.unknown()),
    noCommissionRulesEmitted: z.literal(true),
  }).passthrough().parse(input);
  const documents = inventory.documents.filter((candidate) => {
    const identity = z.object({
      source: z.object({ relativePath: z.string() }).passthrough(),
    }).passthrough().safeParse(candidate);
    return identity.success && identity.data.source.relativePath === sourcePath;
  });
  if (documents.length !== 1) {
    throw new Error(`Expected exactly one Reliance workbook document; found ${documents.length}.`);
  }
  const verificationSchema = z.object({
    relativePath: z.string(),
    listedSha256: z.string().nullable(),
    actualSha256: z.string().nullable(),
    listedByteSize: z.number().int().nullable(),
    actualByteSize: z.number().int().nullable(),
    status: z.enum(["PASS", "FAIL"]),
  }).passthrough();
  const verifications = inventory.manifestVerifications.flatMap((record) => {
    const parsed = verificationSchema.safeParse(record);
    return parsed.success && parsed.data.relativePath === sourcePath ? [parsed.data] : [];
  });
  if (verifications.length !== 1) {
    throw new Error(`Expected exactly one Reliance manifest verification record; found ${verifications.length}.`);
  }
  return {
    document: serializedGridDocumentSchema.parse(documents[0]),
    verification: verifications[0]!,
  };
}
