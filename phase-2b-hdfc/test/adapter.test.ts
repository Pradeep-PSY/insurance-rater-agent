import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { normalizeHdfcErgoInventory } from "../src/adapter.js";
import type { HdfcErgoAdapterDraft } from "../src/schema.js";

describe("HDFC ERGO Phase 2B adapter", () => {
  let draft: HdfcErgoAdapterDraft;
  let originalPages: Array<{
    pageNumber: number;
    width: number;
    height: number;
    textItems: Array<{ text: string; x: number; y: number; width: number; height: number }>;
  }>;

  beforeAll(async () => {
    const inventoryPath = path.resolve(
      process.cwd(),
      "..",
      "phase-2a",
      "artifacts",
      "phase-2a-real-corpus",
      "phase-2a-inventory.json",
    );
    const inventory: unknown = JSON.parse(await readFile(inventoryPath, "utf8"));
    const sourceDocuments = (inventory as {
      documents: Array<{
        source: { relativePath: string };
        pdf?: { pages: typeof originalPages };
      }>;
    }).documents;
    originalPages = sourceDocuments.find((document) =>
      document.source.relativePath ===
        "raters/hdfc-ergo/feb-2025/Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf")
      ?.pdf?.pages ?? [];
    draft = normalizeHdfcErgoInventory(inventory);
  }, 30_000);

  it("verifies and consumes the original manifest-backed Phase 2A PDF IR", () => {
    expect(draft.sourceIdentity.relativePath).toBe(
      "raters/hdfc-ergo/feb-2025/Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf",
    );
    expect(draft.sourceIdentity.sha256).toBe(
      "d0900bf67631151ac5a9b398402279a56e5bc75a13659de6f294a3b298712bf9",
    );
    expect(draft.inventory.manifestVerification).toMatchObject({
      status: "PASS",
      listedSha256: draft.sourceIdentity.sha256,
      actualSha256: draft.sourceIdentity.sha256,
      listedByteSize: 638132,
      actualByteSize: 638132,
    });
    expect(draft.sourceEffectiveDateText).toMatchObject({
      value: "2025-02-01",
      rawText: "Effective from 1st Feb'25",
      extractionStatus: "EXPLICIT_TEXT",
    });
    expect(draft.sourceIdentity.phase2aEffectiveDateStatus).toBe("UNKNOWN");
  });

  it("retains every text item locator and bounding box from both pages", () => {
    expect(draft.inventory.pageCount).toBe(2);
    expect(draft.inventory.pageTextItemCounts).toEqual([
      { pageNumber: 1, count: 311 },
      { pageNumber: 2, count: 54 },
    ]);
    expect(draft.inventory.textItemCount).toBe(365);
    expect(draft.pages.flatMap((page) => page.textItems)).toHaveLength(365);
    const firstItem = draft.pages[0]!.textItems[0]!;
    expect(firstItem).toMatchObject({
      itemIndex: 0,
      locator: "page[1].textItems[0]",
      text: "Effective from 1st Feb'25",
      boundingBox: {
        x: 75.84000225,
        y: 1141.5600015,
        width: expect.any(Number),
        height: expect.any(Number),
      },
    });
    expect(draft.pages[0]!.textItems.every((item) =>
      item.locator === `page[1].textItems[${item.itemIndex}]`)).toBe(true);
    expect(draft.pages[1]!.textItems.every((item) =>
      item.locator === `page[2].textItems[${item.itemIndex}]`)).toBe(true);
    expect(draft.pages.map((page) => ({
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      textItems: page.textItems.map((item) => ({
        text: item.text,
        ...item.boundingBox,
      })),
    }))).toEqual(originalPages);
  });

  it("reconstructs all four zone/product rate tables, 20 slab rows and 60 cells", () => {
    expect(draft.inventory).toMatchObject({
      rateTableCount: 4,
      rateSlabRowCount: 20,
      rateCellCount: 60,
    });
    expect(draft.rateTables.map((table) => `${table.zone}/${table.productCategoryRaw}`)).toEqual([
      "ZONE_1/Package",
      "ZONE_1/SAOD",
      "ZONE_2/Package",
      "ZONE_2/SAOD",
    ]);
    for (const table of draft.rateTables) {
      expect(table.slabRows).toHaveLength(5);
      expect(table.slabRows.map((row) => row.cells)).toHaveLength(5);
      expect(table.slabRows.every((row) =>
        row.slabInterpretationStatus === "SOURCE_LABEL_ONLY_ENDPOINT_SEMANTICS_NOT_ASSIGNED")).toBe(true);
      expect(table.slabRows.every((row) => row.cells.length === 3)).toBe(true);
      expect(table.slabRows.every((row) => row.cells.every((cell) =>
        cell.source.pageNumber === 1 && cell.rawDisplayText.endsWith("%")))).toBe(true);
    }
    const packageRow = draft.rateTables.find((table) =>
      table.zone === "ZONE_2" && table.productCategoryRaw === "Package")!
      .slabRows.find((row) => row.slabLabelRaw === ">10-50k")!;
    expect(packageRow.cells.map((cell) => cell.ratePercent)).toEqual(["17.50", "17.50", "10.00"]);
  });

  it("retains both geography pages and source-grounded Haryana Zone 2 mapping", () => {
    expect(draft.inventory.geographyRowCount).toBeGreaterThan(30);
    expect(draft.geographyTableHeaders.map((header) => header.pageNumber)).toEqual([1, 2]);
    expect(draft.geographyTableHeaders.map((header) =>
      [header.regionHeader, header.stateNameHeader, header.zone1Header, header.zone2Header]
        .map((source) => draft.pages[source.pageNumber - 1]!.textItems[source.itemIndex]!.text)))
      .toEqual([
        ["Zone", "State Name", "Zone-1", "Zone-2"],
        ["Zone", "State Name", "Zone-1", "Zone-2"],
      ]);
    const haryana = draft.geographyRows.find((row) => row.state?.value === "Haryana");
    expect(haryana?.zone2Areas.map((cell) => cell.value)).toContain("Haryana");
    expect(haryana?.state?.source.pageNumber).toBe(2);
    expect(draft.geographyRows.some((row) =>
      row.pageNumber === 1 && row.region?.value === "EAST")).toBe(true);
    expect(draft.geographyRows.some((row) =>
      row.pageNumber === 2 && row.region?.value === "NORTH")).toBe(true);
    expect(draft.inventory.footnoteCount).toBe(4);
    expect(draft.footnotes.map((footnote) => footnote.rawText)).toContain(
      "Slab will be calculated basis comprehensive + SAOD GWP on PVT CAR (SATP premium is excluded for slab achievement)",
    );
  });

  it("keeps lookup and payout bases distinct and withholds the sample's final rate", () => {
    expect(draft.semanticBasis.lookupSlabBasis.meaning)
      .toBe("COMPREHENSIVE_PLUS_SAOD_GWP_EXCLUDING_SATP");
    expect(draft.semanticBasis.payoutBasis.provenance).toBe("PROJECT_OWNER_CLARIFICATION");
    expect(draft.sampleResolutionTrace.payoutBasis.interpretation)
      .toBe("TOTAL_NET_PACKAGE_PREMIUM_OD_PLUS_TP_LIABILITY_EXCLUDING_GST");
    expect(draft.sampleResolutionTrace.decisionStatus).toBe("AMBIGUOUS");
    expect(draft.sampleResolutionTrace.reasonCode).toBe("FUEL_EVIDENCE_MISSING_OR_UNAPPROVED");
    expect(draft.sampleResolutionTrace.componentApplicability).toEqual({
      od: "NOT_SEPARATELY_SPECIFIED",
      tp: "NOT_SEPARATELY_SPECIFIED",
    });
    expect(draft.sampleResolutionTrace.conditionalCandidates).toHaveLength(2);
    expect(draft.sampleResolutionTrace.conditionalCandidates.every((candidate) =>
      candidate.status === "CONDITIONAL_CANDIDATE_NOT_FINAL")).toBe(true);
    expect(draft.sampleResolutionTrace.conditionalCandidates.every((candidate) =>
      candidate.slabSource.pageNumber === 1 && candidate.source.pageNumber === 1)).toBe(true);
    expect(draft.sampleResolutionTrace.finalRatePercent).toBeNull();
    expect(draft.sampleResolutionTrace.finalPayoutAmount).toBeNull();
    expect(draft.noApprovedCommissionRulesEmitted).toBe(true);
  });
});
