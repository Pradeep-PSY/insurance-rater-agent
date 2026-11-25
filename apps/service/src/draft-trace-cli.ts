import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildDraftSampleTraces } from "./draft-traces.js";

const root = path.resolve(process.cwd(), "..", "..");
const sources = [
  ["hdfc", "phase-2b-hdfc/artifacts/hdfc-ergo/hdfc-ergo-adapter-draft.json"],
  ["goDigit", "phase-2b/artifacts/godigit-satp/go-digit-satp-adapter-draft.json"],
  ["reliance", "phase-2b-reliance/artifacts/reliance-private-car/reliance-private-car-adapter-draft.json"],
  ["tataAig", "phase-2b-tata-aig/artifacts/tata-aig-satp/tata-aig-satp-adapter-draft.json"],
] as const;

async function loadDraft(relativePath: string): Promise<unknown> {
  const contents = await readFile(path.join(root, relativePath), "utf8");
  return JSON.parse(contents) as unknown;
}

async function main(): Promise<void> {
  const entries = await Promise.all(sources.map(async ([name, relativePath]) =>
    [name, await loadDraft(relativePath)] as const,
  ));
  const drafts = Object.fromEntries(entries);
  const traces = buildDraftSampleTraces({
    hdfc: drafts.hdfc,
    goDigit: drafts.goDigit,
    reliance: drafts.reliance,
    tataAig: drafts.tataAig,
  });
  const output = path.join(root, "examples", "sample-traces");
  await mkdir(output, { recursive: true });
  for (const trace of traces) {
    const file = `${trace.insurer.toLowerCase().replaceAll("_", "-")}.json`;
    await writeFile(path.join(output, file), `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  }
  console.info(`Generated ${traces.length} draft-only sample traces at ${path.relative(root, output)}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "SAMPLE_TRACE_GENERATION_FAILED");
  process.exitCode = 1;
});
