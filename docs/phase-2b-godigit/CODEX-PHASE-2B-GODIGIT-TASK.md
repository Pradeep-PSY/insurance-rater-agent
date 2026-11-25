# Codex Task – Phase 2B: Implement Go Digit Private Car SATP Adapter

Read the repository `AGENTS.md`, Phase 0 Go Digit rulebook, Phase 0 final report, Phase 2 grid-ingestion blueprint, and Phase 2A README before making changes.

Then follow every requirement in `GO-DIGIT-ADAPTER-SPEC.md` in this folder.

## Scope

Implement only the Go Digit private-car SATP adapter using the existing Phase 2A `GridDocumentIR`/serialized inventory. Do not implement any other insurer adapter.

## First actions

1. Inspect the actual repository structure and current exports from `phase-2a/`.
2. Inspect the real Phase 2A inventory JSON for the Go Digit workbook.
3. Confirm the exact source identity and source hash.
4. Confirm the actual field representation for cells, formulas, cached values, number formats, and source coordinates.
5. If the inventory is missing or cannot provide required provenance, stop and report the exact gap rather than reopening/parsing XLSX inside the adapter.

## Implementation requirements

- Create a separate `phase-2b/` implementation area unless the existing repository architecture clearly provides a better established adapter location. Explain the chosen location.
- Use typed Go Digit adapter-specific draft schemas with Zod.
- Keep the adapter pure with respect to source files: it consumes Phase 2A IR and emits a normalized draft.
- Do not modify `phase-1/` contracts. The Phase 1 P0 fixes are explicitly deferred by the project lead.
- Do not modify Phase 0 rulebooks or original corpus files.
- Do not generate an approved canonical `CommissionRule` for Max CD2.
- Do not implement the rating engine or final insurer-neutral RuleBundle.
- Preserve exact sheet names, row/cell coordinates, raw values, number formats, notes, and formula/cache separation.

## Testing

Implement the tests listed in `GO-DIGIT-ADAPTER-SPEC.md`, including tests against real Phase 2A IR and synthetic edge cases. Tests must prove that no Max CD2 value is emitted as approved commission and that All_India_Decline is not a normal zero rate.

## Validation and reporting

Run from the correct package directory:

- `npm run typecheck`
- `npm test`
- The Go Digit adapter build/normalize command documented by the package

Record exact working directory, command, exit code, Node/npm versions, test files and pass/fail counts. Do not report tests as passing unless they actually ran.

## Stop condition

Stop after Go Digit SATP adapter and its draft/report/tests are complete. Do not start Reliance, Tata AIG, or HDFC. Do not implement the deferred Phase 1 P0 fixes. Report any issue that prevents source-cited normalization.
