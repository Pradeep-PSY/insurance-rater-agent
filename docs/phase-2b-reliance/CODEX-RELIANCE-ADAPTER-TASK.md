# Codex Task – Reliance IndusInd Private Car Adapter

You are implementing the next insurer-specific adapter in the Insurance Rater Agent repository.

## Before coding

Read:
- Root `AGENTS.md`
- `docs/phase-0/reliance-rulebook.md`
- `docs/phase-0/phase-0-final-report.md`
- `docs/phase-2/PHASE-2-GRID-INGESTION-BLUEPRINT.md` if present
- `phase-2a/README.md`
- `phase-2a/src/grid-document-ir.ts` or the actual IR schema location
- The Go Digit implementation under `phase-2b/` (read its README, schemas, adapter, tests, generated draft and report)
- `docs/phase-2b/GO-DIGIT-ADAPTER-SPEC.md` if present

Then read `docs/phase-2b-reliance/RELIANCE-ADAPTER-SPEC.md`.

## Task

Implement an isolated Reliance IndusInd Private Car adapter in:

`phase-2b-reliance/`

Follow the structure/conventions of the existing Go Digit adapter where useful, but do not modify it.

## Mandatory business rules

1. Source workbook:
   `raters/reliance-indusind/feb-2026/Reliance Broking Premier  FEB 26 Grid.xlsx`
2. Manifest identity:
   - bytes: `1928494`
   - SHA-256: `50cd340b3ea5917d4fc6d55e720c14405f26d5076c059414b69a6c03ea7b3142`
3. Account for all eight workbook sheets exactly as listed in the adapter spec.
4. Inspect `FEB'26 - Grid` and `Enabler, PO Guidelines & T&C`; do not assume their contents are irrelevant.
5. Extract the full `RTO List` and `Make Model wise segment` mappings, not only sample rows.
6. Normalize the complete `PRIVATE CAR COMP, SAOD & STP` matrix, preserving merged-header ancestry and exact cells.
7. Preserve H2:H6 terms separately:
   - H2: OD Premium payout basis.
   - H3: `<1000 CC` relative rate multiplier `0.95`, with project-owner clarification provenance dated `2026-11-23`.
   - H4: ZD 2.5% reduction is unresolved; do not apply.
   - H5: Extended Warranty flat 20% wording is conditional; basis/operation must stay unresolved unless authoritative source content establishes them.
   - H6: Tyre/RTI +2.5% additional payout is conditional on sourcing; basis/operation must stay unresolved unless authoritative source content establishes them.
8. Source labels:
   - workbook/file label: `FEB 26`
   - private-car tab title: `Pvt Car Old Business Grid - Jan-26`
   - effective date bounds are unknown. Do not synthesize exact dates from labels.
9. Sample policy issue date is `2025-12-12`.
   - No contemporaneous December 2025 grid or retrospective instruction is supplied.
   - Sample grid applicability must be `NOT_COVERED_FROM_AVAILABLE_EVIDENCE`.
   - Final sample decision must be `UNSUPPORTED`.
   - Do not emit 22.5% or 21.375% as the sample's final commission.
10. Sample facts:
   - proposal form says “Renewal of Policy”;
   - previous insurer is not identified;
   - `existing Reliance General customer = No` is a separate checkbox and is not previous-insurer evidence;
   - RTO UP-16 / 999 CC / Renault Kwid 1.0 RXT O;
   - fuel is not explicitly printed; preserve it as unverified unless an approved external vehicle master is supplied;
   - OD premium ₹4,714; total liability ₹2,519; total package ₹7,233; GST ₹1,302.
11. Mapping:
   - `RTO List!A1253:E1253`: `UP16 → Delhi / T20 / NORTH`.
   - `Make Model wise segment!A397:C397`: `RENAULT / KWID → SMALL`.
   - `SMALL` is not a visible rate-grid column; do not invent a rate adjustment or use it as a lookup dimension.
12. Matrix candidate:
   - `PRIVATE CAR COMP, SAOD & STP!A11:F11` is the NORTH / Delhi row.
   - `C11=22.5` Petrol/Bifuel/Comp.
   - `D11=10` Diesel/EV/Comp.
   - `E11=20` SA OD.
   - `F11=0` STP. Preserve explicit zero distinctly from missing/N/A.
   - This row is only a conditional source candidate; do not use it as the sample's final rate.
13. Use OD Premium as payout basis, not total package premium.
14. No previous insurer inference, fuel inference, latest-grid fallback, or silent mapping deduplication.
15. Do not calculate unsupported ZD/EW/Tyre/RTI adjustments.

## Data and architecture boundaries

- Use Phase 2A `GridDocumentIR` / serialized inventory output as input.
- Do not re-open or reparse the source workbook inside the adapter.
- Do not import ExcelJS or PDF.js in this adapter.
- If Phase 2A IR does not preserve a needed value, merged-header ancestry, number format, or exact cell locator, stop and report that exact limitation. Do not bypass Phase 2A.
- Phase 1 remaining P0 contract defects are deliberately deferred. Use Reliance-specific Zod schemas/types; do not edit `phase-1/`.
- Do not modify Phase 0 documents, `MANIFEST.json`, `phase-2a/`, `phase-2b/`, Go Digit files, or original source documents.
- No runtime rating engine.
- No approved production rule bundle.
- Do not normalize only the sample rows; use the complete in-scope tables.

## Suggested deliverables

- `src/phase-2a-ir.ts` or adapter-local reference to the actual IR type
- `src/schema.ts`
- `src/adapter.ts`
- `src/cli.ts`
- `test/adapter.test.ts`
- `examples/reliance-private-car-draft.example.json`
- Generated real-corpus draft JSON under `artifacts/`
- `RELIANCE-ADAPTER-REPORT.md`
- `README.md`
- `package.json`, `tsconfig.json`, lockfile if needed

The exact file layout may follow Go Digit conventions, but all changes must stay within `phase-2b-reliance/`.

## Tests

Implement all tests in Section 11 of `RELIANCE-ADAPTER-SPEC.md`, including tests for:
- exact workbook identity;
- eight sheet names and sheet metadata;
- all RTO/model rows;
- exact UP16 and Renault Kwid locators;
- complete private-car matrix;
- explicit `F11 = 0`;
- H2–H6 term semantics;
- 0.95 relative multiplier;
- unknown effective date bounds and sample unsupported status;
- no latest-grid fallback;
- previous-insurer/fuel missing treatment;
- no `SMALL` rate dimension;
- no final commission or payout for sample;
- no approved rules emitted;
- source references on every normalized item.

Use both real-corpus tests and synthetic edge-case tests. Derive row counts dynamically from the actual IR; do not hardcode counts as business rules.

## Validation

Run from the package directory:
- `npm run typecheck`
- `npm test`
- `npm run build`
- the adapter normalization CLI using the actual Phase 2A inventory.

Record:
- exact working directory;
- exact command;
- exit code;
- Node/npm versions;
- tests passed/failed;
- source workbook hash verification;
- normalized row counts;
- unresolved items and warnings.

If the environment needs an isolated copy due to WSL `.bin` path issues, state this explicitly and make sure it targets the actual Phase 2A inventory JSON.

## Stop conditions

Stop and report (do not work around) if:
- required workbook values/cell coordinates are missing from Phase 2A IR;
- merged-header context cannot be reconstructed;
- source workbook identity/hash differs;
- a sheet or term conflicts with the Phase 0 rulebook;
- the source doesn't define effective bounds or an adjustment operation.

Do not fabricate. Do not modify files outside `phase-2b-reliance/`.
