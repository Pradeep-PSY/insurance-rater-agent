# Phase 2B — Reliance IndusInd Private-Car Adapter

This package consumes the serialized Phase 2A inventory and produces a
source-cited Reliance-specific draft. It does not open the original workbook,
calculate formulas, emit approved commission rules, or implement a runtime
rating engine.

## Input and commands

Generate the Phase 2A inventory first, then run from this directory:

```bash
npm run typecheck
npm test
npm run build
npm run normalize -- ../phase-2a/artifacts/phase-2a-real-corpus/phase-2a-inventory.json ./artifacts/reliance-private-car
```

The CLI writes `reliance-private-car-adapter-draft.json` and
`RELIANCE-ADAPTER-REPORT.md` to the requested output directory. Tests use the
same inventory path by default; `PHASE_2A_INVENTORY` can point them at another
serialized inventory for isolated validation.

## Source and date boundaries

- The workbook identity is pinned to the manifest-listed relative path,
  byte count, and SHA-256. The adapter also requires a passing Phase 2A
  verification record for that exact file.
- Workbook label `FEB 26` and private-car sheet title
  `Pvt Car Old Business Grid- Jan-26` are retained separately. Neither is
  converted to effective dates.
- The policy issue date `2025-12-12` is the anchor. No supplied grid period
  covers it, so the sample is `UNSUPPORTED` with
  `NOT_COVERED_FROM_AVAILABLE_EVIDENCE`. There is no latest-grid fallback.
- Sample fuel remains unverified, the previous insurer remains missing, and
  `SMALL` is not used as a rate-matrix dimension.

## Normalization boundaries

- All eight workbook sheets are inventoried. The master-grid cells are
  retained raw, including the separate PC STP Non-Diesel zeros; those zeros
  are not interpreted as a commission rule or decline.
- The entire RTO and make/model mapping tables and the complete private-car
  matrix are normalized with source cell locators.
- Private-car merged-header context is reconstructed only from Phase 2A cell
  values and merged ranges. Formulas are not recalculated; formula, cached
  value, error and number-format fields are retained.
- The Phase 2A dimension for `Enabler, PO Guidelines & T&C` is `A3:B62`,
  while the source inspection expectation is `A3:J62`. The adapter reports
  this metadata mismatch and preserves the actual IR dimension; it does not
  reopen or rewrite the workbook. All available enabler cells remain cited
  and unapplied because private-car applicability is unresolved.
- H2 is the OD Premium payout basis. H3 is represented as a relative
  `MULTIPLY_RATE` adjustment by `"0.95"` with project-owner clarification
  provenance. H4-H6 remain conditional and unresolved.
- Candidate matrix values are retained for audit only. No sample rate or
  payout amount is finalized, and no approved production commission rules
  are emitted.

## Package structure

- `src/phase-2a-ir.ts` — local, typed Phase 2A inventory boundary.
- `src/schema.ts` — strict Reliance-specific Zod contracts.
- `src/adapter.ts` — deterministic source normalization and sample trace.
- `src/cli.ts` — JSON/Markdown artifact writer.
- `test/adapter.test.ts` — real-inventory and synthetic edge-case coverage.
- `artifacts/reliance-private-car/` — generated real-corpus draft and report.
