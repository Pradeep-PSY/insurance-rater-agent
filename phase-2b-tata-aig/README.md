# Phase 2B — Tata AIG Private Car SATP Adapter

This isolated package consumes the serialized Phase 2A `GridDocumentIR`. It
does not reopen the XLSX workbook, import ExcelJS, recalculate formulas, or emit
approved `CommissionRule` objects.

## Commands

From this directory:

```powershell
npm run typecheck
npm test
npm run build
npm run normalize -- ..\phase-2a\artifacts\phase-2a-real-corpus\phase-2a-inventory.json .\artifacts\tata-aig-satp
```

Normalization writes `tata-aig-satp-adapter-draft.json` and
`TATA-AIG-ADAPTER-REPORT.md` to the requested output directory.

## Evidence and scope

- The source identity and manifest verification must match the Tata AIG workbook
  before normalization proceeds.
- All seven sheets, including hidden `cv checks` and `pci checks`, are
  inventoried. Formula expressions, cached values, and errors are retained as
  independent fields; no formula is evaluated.
- The complete serialized `Pvtcar` cell matrix is preserved with exact cells.
  Header ancestry is built only from serialized header cells and merge ranges.
  The Phase 2A IR reports no merged ranges.
- The Phase 0 rulebook records the worksheet as extending to `BR568`, while the
  IR dimension ends at `BR567`. This adapter preserves the entire IR and flags
  the boundary discrepancy; it does not reopen the workbook to reconcile it.
- The seven Delhi/CNG/Renewal/SATP candidate rows remain separate, each citing
  its source cells and 38.0% value. No Hatch Back-to-grid-Type mapping is
  asserted.
- Owner high-level override hierarchy and detailed workbook specificity are
  stored independently. No mapping between them is inferred.
- Incremental COA remains pending: GWP thresholds, producer GWP, increment
  value/basis, all-inclusive status, active date/version, and override evidence
  are not established. Stale `pci checks` pivot zeros are not treated as
  current COA evidence.
- The sample base value is a candidate only, not a resolved commission rate or
  final payout. SATP OD is `NOT_APPLICABLE`.
- Source workbook evidence, policy facts, Phase 0 interpretation, and
  project-owner clarifications use separate provenance classes.

The package intentionally does not implement a rating engine, payout
calculation, or settlement accounting.
