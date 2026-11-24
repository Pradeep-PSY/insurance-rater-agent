import ExcelJS from "exceljs";
import type { GridDocumentIR, JsonValue, parserWarningSchema } from "./grid-document-ir.js";
import { gridDocumentIRSchema } from "./grid-document-ir.js";
import type { z } from "zod";

type ParserWarning = z.infer<typeof parserWarningSchema>;

function jsonValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    const record: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) record[key] = jsonValue(child);
    return record;
  }
  return String(value);
}

function errorCode(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if ("error" in value && typeof value.error === "string") return value.error;
  return undefined;
}

export async function readXlsxSource(
  source: Pick<GridDocumentIR["source"], "sourceId" | "insurerId" | "fileName" | "relativePath" | "sha256" | "byteSize">,
  absolutePath: string,
  parserWarnings: ParserWarning[] = [],
): Promise<GridDocumentIR> {
  const warnings: ParserWarning[] = [...parserWarnings];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(absolutePath);
  } catch (error) {
    warnings.push({
      code: "XLSX_PRIMARY_PARSER_FAILED",
      severity: "BLOCKER",
      message: `ExcelJS failed to open the workbook: ${error instanceof Error ? error.message : String(error)}`,
    });
    return gridDocumentIRSchema.parse({
      schemaVersion: "2A.0.0",
      source: {
        ...source,
        format: "XLSX",
        sourcePeriodLabel: undefined,
        effectiveFrom: null,
        effectiveTo: null,
        effectiveDateStatus: "UNKNOWN",
      },
      workbook: { sheets: [] },
      warnings,
    });
  }

  const sheets = workbook.worksheets.map((sheet, order) => {
    const visibility =
      sheet.state === "veryHidden"
        ? "VERY_HIDDEN"
        : sheet.state === "hidden"
          ? "HIDDEN"
          : "VISIBLE";

    const mergedRanges =
      sheet.model?.merges && Array.isArray(sheet.model.merges)
        ? sheet.model.merges.map(String)
        : [];

    const cells: Array<{
      address: string;
      rawValue: JsonValue;
      formula?: string;
      cachedValue?: JsonValue;
      errorCode?: string;
      numberFormat?: string;
      styleId?: number;
    }> = [];

    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
      const formulaValue =
        cell.value !== null &&
        typeof cell.value === "object" &&
        !Array.isArray(cell.value)
          ? cell.value as { formula?: string; result?: unknown; error?: unknown }
          : null;
      const formula =
        typeof cell.formula === "string" && cell.formula.length > 0
          ? cell.formula
          : typeof formulaValue?.formula === "string"
            ? formulaValue.formula
            : undefined;
      const cachedResult =
        formulaValue && "result" in formulaValue
          ? jsonValue(formulaValue.result)
          : undefined;
      const detectedError =
        formulaValue && "error" in formulaValue
          ? errorCode(formulaValue)
          : formulaValue &&
              "result" in formulaValue &&
              typeof formulaValue.result === "object" &&
              formulaValue.result !== null &&
              "error" in formulaValue.result &&
              typeof (formulaValue.result as { error?: unknown }).error === "string"
            ? (formulaValue.result as { error: string }).error
          : typeof cell.value === "object" &&
              cell.value !== null &&
              "error" in cell.value &&
              typeof (cell.value as { error?: unknown }).error === "string"
            ? (cell.value as { error: string }).error
            : undefined;

      if (
        cell.value === null &&
        formula === undefined &&
        detectedError === undefined
      ) {
        return;
      }

      const numFmt =
        typeof cell.numFmt === "string" && cell.numFmt.length > 0
          ? cell.numFmt
          : undefined;
      const styleId: number | undefined = undefined;

      const inventoryCell: {
        address: string;
        rawValue: JsonValue;
        formula?: string;
        cachedValue?: JsonValue;
        errorCode?: string;
        numberFormat?: string;
        styleId?: number;
      } = {
        address: cell.address,
        rawValue: jsonValue(cell.value),
      };
      if (formula !== undefined) inventoryCell.formula = formula;
      if (cachedResult !== undefined) inventoryCell.cachedValue = cachedResult;
      if (detectedError !== undefined) inventoryCell.errorCode = detectedError;
      if (numFmt !== undefined) inventoryCell.numberFormat = numFmt;
      if (styleId !== undefined) inventoryCell.styleId = styleId;
      cells.push(inventoryCell);
      });
    });

    warnings.push({
      code: "XLSX_SHEET_INVENTORY",
      severity: "INFO",
      locator: sheet.name,
      message: `Inventoried ${cells.length} non-empty cells; ${mergedRanges.length} merged ranges.`,
    });

    return {
      name: sheet.name,
      order,
      visibility,
      dimension: sheet.dimensions?.shortRange ?? null,
      actualRowCount: sheet.actualRowCount,
      actualColumnCount: sheet.actualColumnCount,
      mergedRanges,
      cells,
    };
  });

  if (workbook.worksheets.length === 0) {
    warnings.push({
      code: "XLSX_NO_SHEETS",
      severity: "BLOCKER",
      message: "Workbook contains no worksheets.",
    });
  }

  return gridDocumentIRSchema.parse({
    schemaVersion: "2A.0.0",
    source: {
      ...source,
      format: "XLSX",
      sourcePeriodLabel: undefined,
      effectiveFrom: null,
      effectiveTo: null,
      effectiveDateStatus: "UNKNOWN",
    },
    workbook: { sheets },
    warnings,
  });
}
