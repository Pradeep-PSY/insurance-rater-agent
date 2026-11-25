import { z } from "zod";
import {
  inventoryInputSchema,
  type JsonValue,
  type SerializedGridCell,
  type SerializedGridDocument,
  type SerializedGridSheet,
} from "./phase-2a-ir.js";
import {
  rawCellEvidenceSchema,
  tataAigAdapterDraftSchema,
  type RawCellEvidence,
  type TataAigAdapterDraft,
} from "./schema.js";

const sourcePath =
  "raters/tata-aig/march-2026/Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx";
const sourceSha256 =
  "c62b657e7d819a250cb86549c177f88ff0277835d39a2a3e0d337fdc9915f879";
const phase0Rulebook = "docs/phase-0/tata-aig-rulebook.md";
const phase0Report = "docs/phase-0/phase-0-final-report.md";
const samplePolicy = "sample-policies/pvt-car-satp-tata-aig.pdf";
const ownerClarificationFile =
  "Project-owner clarification recorded in docs/phase-0/tata-aig-rulebook.md";

const expectedSheets = [
  "General Guidelines",
  "cv checks",
  "pci checks",
  "Pvtcar",
  "CV",
  "TW",
  "Pvtcar_Extended Warranty",
] as const;

const typeCategories = [
  "Compact",
  "MPV SUV",
  "Mid Size",
  "Ultra High End",
  "Mini",
  "High End",
  "Quadricycle",
] as const;

const columnIndex = (column: string): number =>
  [...column].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);

function columnName(index: number): string {
  let remainder = index;
  let column = "";
  while (remainder > 0) {
    const digit = (remainder - 1) % 26;
    column = String.fromCharCode(65 + digit) + column;
    remainder = Math.floor((remainder - 1) / 26);
  }
  return column;
}

function addressParts(address: string): { column: string; row: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (!match) throw new Error(`Unsupported Phase 2A cell address: ${address}`);
  return { column: match[1]!, row: Number(match[2]) };
}

function cellEvidence(sheet: SerializedGridSheet, cell: SerializedGridCell): RawCellEvidence {
  return rawCellEvidenceSchema.parse({
    source: { sheet: sheet.name, cell: cell.address },
    rawValue: cell.rawValue,
    formula: cell.formula ?? null,
    cachedValuePresent: cell.cachedValue !== undefined,
    cachedValue: cell.cachedValue ?? null,
    errorCode: cell.errorCode ?? null,
    numberFormat: cell.numberFormat ?? null,
  });
}

function evidenceForAddress(
  sheet: SerializedGridSheet,
  address: string,
): RawCellEvidence | undefined {
  const cell = sheet.cells.find((candidate) => candidate.address === address);
  return cell ? cellEvidence(sheet, cell) : undefined;
}

function rawString(value: JsonValue | undefined): string | null {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function mergedRangeBounds(range: string): {
  firstColumn: number;
  lastColumn: number;
  firstRow: number;
  lastRow: number;
} | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
  if (!match) return null;
  return {
    firstColumn: columnIndex(match[1]!),
    firstRow: Number(match[2]),
    lastColumn: columnIndex(match[3]!),
    lastRow: Number(match[4]),
  };
}

function buildMatrix(sheet: SerializedGridSheet): {
  columnContexts: TataAigAdapterDraft["pvtcarMatrix"]["columnContexts"];
  rows: TataAigAdapterDraft["pvtcarMatrix"]["rows"];
} {
  const cellsByRow = new Map<number, SerializedGridCell[]>();
  const columns = new Set<string>();

  for (const cell of sheet.cells) {
    const { column, row } = addressParts(cell.address);
    columns.add(column);
    const rowCells = cellsByRow.get(row) ?? [];
    rowCells.push(cell);
    cellsByRow.set(row, rowCells);
  }
  for (const range of sheet.mergedRanges) {
    const bounds = mergedRangeBounds(range);
    if (bounds === null) continue;
    for (let index = bounds.firstColumn; index <= bounds.lastColumn; index += 1) {
      columns.add(columnName(index));
    }
  }

  const columnContexts = [...columns]
    .sort((left, right) => columnIndex(left) - columnIndex(right))
    .map((column) => {
      const currentColumn = columnIndex(column);
      const ancestry = sheet.cells
        .filter((cell) => {
          const parts = addressParts(cell.address);
          if (parts.row > 5) return false;
          if (parts.column === column) return true;
          return sheet.mergedRanges.some((range) => {
            const bounds = mergedRangeBounds(range);
            return bounds !== null &&
              bounds.firstRow <= 5 &&
              bounds.lastRow >= parts.row &&
              currentColumn >= bounds.firstColumn &&
              currentColumn <= bounds.lastColumn &&
              parts.column === range.split(":")[0]!.replace(/\d+$/, "").replace(/\$/, "");
          });
        })
        .sort((left, right) => {
          const a = addressParts(left.address);
          const b = addressParts(right.address);
          return a.row - b.row || columnIndex(a.column) - columnIndex(b.column);
        })
        .map((cell) => {
          const bounds = sheet.mergedRanges.find((range) => {
            const parsed = mergedRangeBounds(range);
            if (parsed === null) return false;
            const { row, column: cellColumn } = addressParts(cell.address);
            return row >= parsed.firstRow &&
              row <= parsed.lastRow &&
              currentColumn >= parsed.firstColumn &&
              currentColumn <= parsed.lastColumn &&
              cellColumn === range.split(":")[0]!.replace(/\d+$/, "").replace(/\$/, "");
          });
          return {
            evidence: cellEvidence(sheet, cell),
            appliesThroughMergedRange: bounds ?? null,
          };
        });

      return { column, headerAncestry: ancestry };
    });

  const rows = [...cellsByRow.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rowNumber, rowCells]) => ({
      rowNumber,
      cells: rowCells
        .sort((left, right) => {
          const a = addressParts(left.address);
          const b = addressParts(right.address);
          return columnIndex(a.column) - columnIndex(b.column);
        })
        .map((cell) => cellEvidence(sheet, cell)),
    }));

  return { columnContexts, rows };
}

function sourceReference(
  sourceKind: "INSURER_GRID" | "PHASE_0_RULEBOOK" | "POLICY_PDF" | "OWNER_CLARIFICATION",
  file: string,
  details: { sheet?: string; cell?: string; page?: number; section?: string; clarificationDate?: string } = {},
) {
  return { sourceKind, file, ...details };
}

function percentDisplay(rawDecimal: string, numberFormat: string | null): string {
  const percentage = shiftDecimal(rawDecimal, 2);
  const precisionMatch = numberFormat?.match(/\.([0#]+)/);
  const precision = precisionMatch?.[1]?.length ?? 0;
  const [whole = "0", fraction = ""] = percentage.split(".");
  const roundedText = precision === 0
    ? whole
    : `${whole}.${(fraction + "0".repeat(precision)).slice(0, precision)}`;
  return `${roundedText}%`;
}

function shiftDecimal(value: string, places: number): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const sign = match[1] ?? "";
  const digits = `${match[2]}${match[3] ?? ""}`;
  const decimalPosition = (match[2]?.length ?? 0) + places;
  const padded = digits.padEnd(decimalPosition + 1, "0");
  const whole = (padded.slice(0, decimalPosition) || "0").replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(decimalPosition).replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

function buildCandidates(sheet: SerializedGridSheet): TataAigAdapterDraft["sampleResolutionTrace"]["candidateTypes"] {
  const cellByAddress = new Map(sheet.cells.map((cell) => [cell.address, cell]));
  const rowNumbers = new Set(
    sheet.cells
      .map((cell) => addressParts(cell.address).row)
      .filter((row) => row > 5),
  );

  const candidates = [...rowNumbers]
    .sort((left, right) => left - right)
    .flatMap((sourceRow) => {
      const values = {
        type: rawString(cellByAddress.get(`G${sourceRow}`)?.rawValue),
        businessType: rawString(cellByAddress.get(`H${sourceRow}`)?.rawValue),
        fuelType: rawString(cellByAddress.get(`I${sourceRow}`)?.rawValue),
        section: rawString(cellByAddress.get(`J${sourceRow}`)?.rawValue),
        ncb: rawString(cellByAddress.get(`K${sourceRow}`)?.rawValue),
        addOn: rawString(cellByAddress.get(`L${sourceRow}`)?.rawValue),
        location: rawString(cellByAddress.get(`V${sourceRow}`)?.rawValue),
      };
      if (
        !typeCategories.includes(values.type as typeof typeCategories[number]) ||
        values.businessType !== "Renewal" ||
        values.fuelType !== "CNG" ||
        values.section?.trim() !== "SATP" ||
        values.ncb !== "All" ||
        values.addOn !== "All"
      ) {
        return [];
      }

      const rateCell = cellByAddress.get(`V${sourceRow}`);
      if (!rateCell || typeof rateCell.rawValue !== "number") return [];
      const evidenceCells = ["G", "H", "I", "J", "K", "L", "V"]
        .map((column) => cellByAddress.get(`${column}${sourceRow}`))
        .filter((cell): cell is SerializedGridCell => cell !== undefined)
        .map((cell) => cellEvidence(sheet, cell));
      const rateEvidence = cellEvidence(sheet, rateCell);
      const rawDecimal = String(rateCell.rawValue);
      return [{
        sourceRow,
        typeCategory: values.type!,
        dimensions: {
          businessType: values.businessType,
          fuelType: values.fuelType,
          section: values.section!,
          ncb: values.ncb!,
          addOn: values.addOn!,
          locationHeader: "DELHI",
        },
        rate: {
          rawDecimal,
          displayedPercent: percentDisplay(rawDecimal, rateCell.numberFormat ?? null),
          numberFormat: rateCell.numberFormat ?? null,
          evidence: rateEvidence,
        },
        rowEvidence: evidenceCells,
      }];
    });

  return candidates;
}

function buildSheetInventory(sheet: SerializedGridSheet) {
  const formulas = sheet.cells.filter((cell) => cell.formula !== undefined);
  const errors = sheet.cells.filter((cell) => cell.errorCode !== undefined);
  const scopeByName: Record<string, z.infer<typeof import("./schema.js").sheetScopeSchema>> = {
    "General Guidelines": "GUIDELINES_AND_PRIORITY",
    "cv checks": "HIDDEN_CACHED_CHECKS",
    "pci checks": "HIDDEN_CACHED_CHECKS",
    Pvtcar: "BASE_PRIVATE_CAR_GRID",
    CV: "OUT_OF_SCOPE_COMMERCIAL_VEHICLE_GRID",
    TW: "OUT_OF_SCOPE_TWO_WHEELER_GRID",
    "Pvtcar_Extended Warranty": "OUT_OF_SCOPE_EXTENDED_WARRANTY_GRID",
  };
  const scope = scopeByName[sheet.name];
  if (!scope) throw new Error(`Unclassified Tata AIG workbook sheet: ${sheet.name}`);
  return {
    name: sheet.name,
    order: sheet.order,
    visibility: sheet.visibility,
    scope,
    dimension: sheet.dimension,
    actualRowCount: sheet.actualRowCount,
    actualColumnCount: sheet.actualColumnCount,
    nonEmptyCellCount: sheet.cells.length,
    mergedRanges: sheet.mergedRanges,
    formulaCount: formulas.length,
    formulaCachedValueCount: formulas.filter((cell) => cell.cachedValue !== undefined).length,
    errorCellCount: errors.length,
    formulaEvidence: formulas.map((cell) => cellEvidence(sheet, cell)),
    errorEvidence: errors.map((cell) => cellEvidence(sheet, cell)),
  };
}

function getRequiredSheet(
  document: SerializedGridDocument,
  name: string,
): SerializedGridSheet {
  const sheet = document.workbook?.sheets.find((candidate) => candidate.name === name);
  if (!sheet) throw new Error(`Required Tata AIG workbook sheet is missing: "${name}"`);
  return sheet;
}

export function inventoryDocumentForTataAig(inventoryValue: unknown): SerializedGridDocument {
  const inventory = inventoryInputSchema.parse(inventoryValue);
  const document = inventory.documents.find(
    (candidate) => candidate.source.relativePath === sourcePath,
  );
  if (!document) throw new Error(`Tata AIG document is missing from Phase 2A inventory: ${sourcePath}`);
  if (
    document.source.insurerId !== "TATA_AIG" ||
    document.source.sha256.toLowerCase() !== sourceSha256 ||
    document.source.format !== "XLSX"
  ) {
    throw new Error("Tata AIG Phase 2A source identity does not match the reviewed workbook.");
  }
  const verification = inventory.manifestVerifications.find(
    (entry) => entry.relativePath === sourcePath,
  );
  if (
    !verification ||
    verification.status !== "PASS" ||
    verification.listedSha256?.toLowerCase() !== sourceSha256 ||
    verification.actualSha256?.toLowerCase() !== sourceSha256 ||
    verification.listedByteSize !== document.source.byteSize ||
    verification.actualByteSize !== document.source.byteSize
  ) {
    throw new Error("Tata AIG manifest integrity verification is missing or failed.");
  }
  const names = document.workbook?.sheets.map((sheet) => sheet.name) ?? [];
  if (
    names.length !== expectedSheets.length ||
    expectedSheets.some((name, index) => names[index] !== name)
  ) {
    throw new Error("Tata AIG Phase 2A IR does not contain the expected seven sheets in source order.");
  }
  return document;
}

export function normalizeTataAig(
  document: SerializedGridDocument,
): TataAigAdapterDraft {
  const pvtcar = getRequiredSheet(document, "Pvtcar");
  const general = getRequiredSheet(document, "General Guidelines");
  if (rawString(evidenceForAddress(pvtcar, "V5")?.rawValue) !== "DELHI") {
    throw new Error("Pvtcar!V5 does not identify the expected DELHI rate column.");
  }
  const candidates = buildCandidates(pvtcar);
  const candidateTypes = candidates.map((candidate) => candidate.typeCategory);
  const rateValues = new Set(candidates.map((candidate) => candidate.rate.rawDecimal));
  const invariant = candidates.length === typeCategories.length &&
    typeCategories.every((category) => candidateTypes.includes(category)) &&
    rateValues.size === 1;
  const candidateRate = invariant ? candidates[0]?.rate : undefined;
  if (!candidateRate) {
    throw new Error(
      `Could not establish an invariant Delhi/CNG/Renewal/SATP candidate from the IR: ${candidates.length} candidate rows.`,
    );
  }

  const matrix = buildMatrix(pvtcar);
  const sheetInventory = document.workbook!.sheets.map(buildSheetInventory);
  const formulaCount = sheetInventory.reduce((sum, sheet) => sum + sheet.formulaCount, 0);
  const formulaCachedValueCount = sheetInventory.reduce(
    (sum, sheet) => sum + sheet.formulaCachedValueCount,
    0,
  );
  const errorCellCount = sheetInventory.reduce((sum, sheet) => sum + sheet.errorCellCount, 0);
  const mergedRangeCount = sheetInventory.reduce(
    (sum, sheet) => sum + sheet.mergedRanges.length,
    0,
  );
  const policyRef = (page: number) => sourceReference("POLICY_PDF", samplePolicy, { page });
  const ruleRef = (sheet: string, cell: string, section: string) =>
    sourceReference("INSURER_GRID", document.source.fileName, { sheet, cell, section });
  const rulebookRef = (section: string) =>
    sourceReference("PHASE_0_RULEBOOK", phase0Rulebook, { section });
  const ownerRef = (section: string) =>
    sourceReference("OWNER_CLARIFICATION", ownerClarificationFile, {
      section,
      clarificationDate: "2026-11-23",
    });

  const pvtcarF1 = evidenceForAddress(pvtcar, "F1");
  const pvtcarF3 = evidenceForAddress(pvtcar, "F3");
  const guidelinesC5 = evidenceForAddress(general, "C5");
  const matrixLastRow = matrix.rows.at(-1)?.rowNumber ?? 0;
  const phase0Dimension = "A1:BR568";
  const boundaryDiscrepancy = pvtcar.dimension !== phase0Dimension;
  const sourceWarnings = [
    {
      code: "SHEET_BOUNDARY_DISCREPANCY",
      severity: "WARNING" as const,
      message: `Phase 2A Pvtcar IR dimension is ${pvtcar.dimension}; Phase 0 documentation records ${phase0Dimension}. The adapter preserves only serialized IR cells through row ${matrixLastRow} and does not reopen the workbook to reconcile the boundary.`,
      evidence: [rulebookRef("6. Incremental COA and stale hidden pivot")],
    },
    {
      code: "STALE_PCI_CHECKS_NOT_COA_EVIDENCE",
      severity: "WARNING" as const,
      message: "The Phase 0 rulebook identifies the pci checks cached pivot as stale/out of range. Its cached zeros are excluded as current incremental COA evidence; Phase 2A IR does not include pivot-cache source metadata.",
      evidence: [
        rulebookRef("6. Incremental COA and stale hidden pivot"),
        ruleRef("pci checks", "A3", "hidden cached check sheet inventory only"),
      ],
    },
    {
      code: "ACTIVE_GRID_DATE_UNRESOLVED",
      severity: "WARNING" as const,
      message: "The IR has no explicit effective date. Pvtcar!F1 states an applicability threshold, but the sample issue/login anchor and active month-specific version are not established by this grid IR.",
      evidence: [ruleRef("Pvtcar", "F1", "effective applicability statement")],
    },
    {
      code: "COA_INPUTS_MISSING",
      severity: "WARNING" as const,
      message: "The source only establishes that GWP-based incremental COA exists; no validated slab thresholds, producer GWP, increment amount/basis, or all-inclusive status is available for this sample.",
      evidence: [
        ruleRef("General Guidelines", "C5", "base commission and incremental COA note"),
        ruleRef("Pvtcar", "F3", "base commission and GWP-based rule note"),
      ],
    },
  ];

  const draft = {
    schemaVersion: "2B.TATA_AIG.1.0" as const,
    sourceIdentity: {
      insurerId: "TATA_AIG" as const,
      fileName: document.source.fileName,
      relativePath: document.source.relativePath,
      sha256: document.source.sha256,
      byteSize: document.source.byteSize,
      sourcePeriodLabel: document.source.sourcePeriodLabel ?? null,
      effectiveFrom: document.source.effectiveFrom,
      effectiveTo: document.source.effectiveTo,
      effectiveDateStatus: document.source.effectiveDateStatus,
      sourceIdentityVerification: "PASS" as const,
    },
    sheetInventory,
    matrixCoverage: {
      status: "COMPLETE_FOR_SERIALIZED_IR" as const,
      sourceDimension: pvtcar.dimension,
      phase0DocumentedDimension: phase0Dimension,
      boundaryDiscrepancy,
      note: `Every non-empty cell in the serialized Pvtcar IR has been retained. The final serialized cell row is ${matrixLastRow}; no claim is made about cells absent from the IR.`,
    },
    pvtcarMatrix: {
      sheet: "Pvtcar" as const,
      headerRows: [1, 2, 3, 4, 5],
      columnContexts: matrix.columnContexts,
      rows: matrix.rows,
      sourceCellCount: pvtcar.cells.length,
      mergedRangeCount: pvtcar.mergedRanges.length,
    },
    overrideModel: {
      ownerHighLevelHierarchy: ["SPECIAL_DEAL", "SPECIFIC_SUB_SEGMENT", "STANDARD_GRID"],
      detailedWorkbookSpecificity: [
        "POLICY_SPECIFIC",
        "FLEET_CODE",
        "PAN_SPECIFIC",
        "CODE_SPECIFIC",
        "STANDARD_GRID",
      ],
      mappingBetweenHierarchies: "NOT_DEFINED" as const,
      evidence: {
        ownerClarification: ownerRef("9A. Business clarifications supplied by the project owner"),
        detailedSpecificity: [
          ruleRef("General Guidelines", "C12", "calculation sequence: policy specific"),
          ruleRef("General Guidelines", "C13", "calculation sequence: fleet code basis"),
          ruleRef("General Guidelines", "C14", "calculation sequence: PAN specific"),
          ruleRef("General Guidelines", "C15", "calculation sequence: code specific"),
          ruleRef("General Guidelines", "C16", "calculation sequence: standard grid"),
        ],
        inconsistency: ruleRef(
          "General Guidelines",
          "C17",
          "wording inconsistency with detailed priority list",
        ),
      },
      overrideDataStatus: "NOT_SUPPLIED" as const,
    },
    coaAssessment: {
      status: "PENDING_INSUFFICIENT_EVIDENCE" as const,
      sourceMentionsIncrement: [
        ruleRef("General Guidelines", "C5", "GWP-based incremental COA statement"),
        ruleRef("Pvtcar", "F3", "GWP-based incremental COA statement"),
      ],
      stalePivotTreatment: "EXCLUDED_AS_CURRENT_COA_EVIDENCE" as const,
      stalePivotContext: {
        sheet: "pci checks" as const,
        cachedPivotSourceRange: "Pvtcar!G5:BO131" as const,
        phase0DocumentedPvtcarExtent: "A1:BR568" as const,
        cachedPivotRefreshDate: "2024-04-23" as const,
        evidence: rulebookRef("6. Incremental COA and stale hidden pivot"),
      },
      missingInputs: [
        "ACTIVE_POLICY_DATE_OR_INSURER_DEFINED_LOGIN_DATE",
        "CURRENT_GWP_SLAB_THRESHOLDS",
        "PRODUCER_GWP_AND_MEASUREMENT_WINDOW",
        "INCREMENT_VALUE_AND_BASIS",
        "BASE_RULE_ALL_INCLUSIVE_STATUS",
        "ELIGIBILITY_AND_OVERRIDE_EVIDENCE",
      ],
      normalizedIncrementalRules: [],
    },
    sampleResolutionTrace: {
      policyClass: "PRIVATE_CAR_SATP" as const,
      bodyType: "Hatch Back" as const,
      bodyTypeToGridTypeMapping: "NOT_ASSERTED" as const,
      knownDimensions: {
        businessType: "Renewal" as const,
        fuelType: "CNG" as const,
        section: "SATP" as const,
        ncb: "All" as const,
        addOn: "All" as const,
        locationHeader: "DELHI" as const,
      },
      sampleContext: {
        policyIssueDateStatus: "NOT_ESTABLISHED" as const,
        insurerDefinedLoginDateStatus: "UNKNOWN" as const,
        coverStartDate: "2026-04-01" as const,
        coverStartDateUsedAsAnchor: false as const,
        intermediaryCode: {
          value: "721" as const,
          evidence: [policyRef(4)],
        },
        netPremium: {
          amountDecimal: "2154" as const,
          currency: "INR" as const,
          premiumBasis: "NET_PREMIUM" as const,
          evidence: [
            policyRef(5),
            ruleRef("General Guidelines", "C7", "SATP payout percentage on Net Premium"),
            ruleRef("Pvtcar", "F2", "SATP payout percentage on Net Premium"),
          ],
        },
        gst: {
          amountDecimal: "388" as const,
          currency: "INR" as const,
          excludedFromNetPremiumBasis: true as const,
          evidence: [policyRef(5)],
        },
        sameInsurerRenewal: true as const,
        coverageGapContext: {
          previousPolicyExpiryDate: "2024-08-30" as const,
          currentCoverStartDate: "2026-04-01" as const,
          preservedWithoutReclassification: true as const,
        },
        evidence: [
          policyRef(1),
          policyRef(11),
          rulebookRef("2. Policy facts extracted from the supplied PDF"),
        ],
      },
      baseCandidateStatus: "INVARIANT_ACROSS_ALL_TYPES" as const,
      candidateTypes: candidates,
      baseRateCandidate: {
        rawDecimal: candidateRate.rawDecimal,
        displayedPercent: candidateRate.displayedPercent,
        basis: "NET_PREMIUM" as const,
        approvedFinalRate: false as const,
        basisEvidence: [
          ruleRef("General Guidelines", "C7", "SATP payout percentage on Net Premium"),
          ruleRef("Pvtcar", "F2", "SATP payout percentage on Net Premium"),
        ],
      },
      odApplicability: "NOT_APPLICABLE" as const,
      allInPayoutStatus: "PENDING" as const,
      stages: [
        {
          stage: "DATE_ANCHOR" as const,
          status: "PENDING" as const,
          reason: "A verified policy issue date or insurer-defined login-date requirement is not established by the available source IR.",
          evidence: [
            ownerRef("9A. Business clarifications supplied by the project owner"),
            policyRef(1),
          ],
        },
        {
          stage: "ACTIVE_GRID_VERSION" as const,
          status: "PENDING" as const,
          reason: "The grid IR effective-date status is UNKNOWN; the month-specific version cannot be selected without a verified anchor.",
          evidence: [ruleRef("Pvtcar", "F1", "effective applicability statement")],
        },
        {
          stage: "OVERRIDE_SELECTION" as const,
          status: "PENDING" as const,
          reason: "No policy-, fleet-, PAN-, code-specific override records or authoritative no-override confirmation are supplied.",
          evidence: [
            rulebookRef("9A. Business clarifications supplied by the project owner"),
            ruleRef("General Guidelines", "C12", "override hierarchy"),
          ],
        },
        {
          stage: "INCREMENTAL_COA" as const,
          status: "PENDING" as const,
          reason: "Producer GWP, current slab, increment value/basis, and base-rule all-inclusive status are unavailable; stale pivot zeros are not used.",
          evidence: [
            ruleRef("General Guidelines", "C5", "incremental COA"),
            ruleRef("Pvtcar", "F3", "incremental COA"),
            rulebookRef("6. Incremental COA and stale hidden pivot"),
          ],
        },
        {
          stage: "GROSS_PAYOUT" as const,
          status: "PENDING" as const,
          reason: "A candidate base rate is not an all-in payout; the date, override, and incremental COA stages are pending.",
          evidence: [rulebookRef("11. Gross payout vs net settlement")],
        },
        {
          stage: "SETTLEMENT" as const,
          status: "PENDING" as const,
          reason: "No signed settlement entries or authoritative accounting semantics are available; tax/clawback adjustments are not calculated.",
          evidence: [rulebookRef("9A. Business clarifications supplied by the project owner")],
        },
      ],
      policyEvidence: [
        policyRef(1),
        policyRef(4),
        policyRef(5),
        policyRef(11),
        rulebookRef("2. Policy facts extracted from the supplied PDF"),
      ],
    },
    warnings: sourceWarnings,
    noApprovedCommissionRulesEmitted: true as const,
    validationSummary: {
      sheetCount: 7 as const,
      hiddenSheetCount: sheetInventory.filter((sheet) => sheet.visibility !== "VISIBLE").length,
      pvtcarMatrixRowCount: matrix.rows.length,
      pvtcarCellCount: pvtcar.cells.length,
      formulaCount,
      formulaCachedValueCount,
      errorCellCount,
      mergedRangeCount,
      candidateTypeCount: candidates.length,
      approvedCommissionRuleCount: 0 as const,
    },
  };

  return tataAigAdapterDraftSchema.parse(draft);
}
