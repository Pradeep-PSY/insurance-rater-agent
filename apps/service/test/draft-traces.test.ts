import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDraftSampleTraces } from "../src/draft-traces.js";

const root = path.resolve(process.cwd(), "..", "..");

async function readDraft(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8")) as unknown;
}

describe("draft adapter to sample-trace bridge", () => {
  it("consumes all four real adapter drafts without approving candidate rates", async () => {
    const [hdfc, goDigit, reliance, tataAig] = await Promise.all([
      readDraft("phase-2b-hdfc/artifacts/hdfc-ergo/hdfc-ergo-adapter-draft.json"),
      readDraft("phase-2b/artifacts/godigit-satp/go-digit-satp-adapter-draft.json"),
      readDraft("phase-2b-reliance/artifacts/reliance-private-car/reliance-private-car-adapter-draft.json"),
      readDraft("phase-2b-tata-aig/artifacts/tata-aig-satp/tata-aig-satp-adapter-draft.json"),
    ]);
    const traces = buildDraftSampleTraces({ hdfc, goDigit, reliance, tataAig });

    expect(traces.map((trace) => trace.insurer)).toEqual([
      "HDFC_ERGO",
      "GO_DIGIT",
      "RELIANCE_INDUSIND",
      "TATA_AIG",
    ]);
    expect(traces.every((trace) => trace.adapterStatus === "DRAFT_NOT_APPROVED")).toBe(true);
    expect(traces.every((trace) =>
      trace.components.every((component) => component.finalRatePercent === null))).toBe(true);

    const hdfcTrace = traces[0]!;
    expect(hdfcTrace.decisionStatus).toBe("AMBIGUOUS");
    expect(hdfcTrace.components.find((component) => component.component === "PACKAGE")?.candidateRatePercent).toBe("17.50");
    expect(hdfcTrace.components.filter((component) => component.component === "OD" || component.component === "TP")
      .every((component) => component.applicability === "NOT_SEPARATELY_SPECIFIED")).toBe(true);

    const goDigitTrace = traces[1]!;
    expect(goDigitTrace.components.find((component) => component.component === "OD")?.applicability).toBe("NOT_APPLICABLE");
    expect(goDigitTrace.uninterpretedMetrics).toEqual([expect.objectContaining({
      fieldName: "Max CD2",
      rawValue: "0.295",
    })]);
    expect(goDigitTrace.components.find((component) => component.component === "TP")?.finalRatePercent).toBeNull();
    expect(goDigitTrace.components.find((component) => component.component === "TP")?.evidence)
      .toContainEqual(expect.objectContaining({ sheet: "4W  RTO", cellRange: "B1609:C1609" }));

    const relianceTrace = traces[2]!;
    expect(relianceTrace.decisionStatus).toBe("UNSUPPORTED");
    expect(relianceTrace.gridSelection.status).toBe("NO_APPLICABLE_VERSION");
    expect(relianceTrace.gridSelection.latestGridFallbackUsed).toBe(false);
    expect(relianceTrace.rateAdjustments).toContainEqual(expect.objectContaining({
      operation: "MULTIPLY_RATE",
      operand: "0.95",
      status: "NOT_APPLIED",
    }));
    expect(relianceTrace.payoutStages[0]?.status).toBe("NOT_CALCULATED");

    const tataTrace = traces[3]!;
    expect(tataTrace.decisionStatus).toBe("AMBIGUOUS");
    expect(tataTrace.components.find((component) => component.component === "OD")?.applicability).toBe("NOT_APPLICABLE");
    expect(tataTrace.components.find((component) => component.component === "TP")?.candidateRatePercent).toBe("38.0");
    expect(tataTrace.payoutStages.every((stage) => stage.status === "PENDING")).toBe(true);
    const tataEvidence = tataTrace.components.find((component) => component.component === "TP")?.evidence ?? [];
    for (const cell of ["V511", "V515", "V519", "V523", "V527", "V531", "V535"]) {
      expect(tataEvidence).toContainEqual(expect.objectContaining({ sheet: "Pvtcar", cellRange: cell }));
    }
    expect(tataTrace.trace.find((step) => step.stage === "INCREMENTAL_COA")?.evidence).toEqual([]);
  });
});
