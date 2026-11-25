# Tata AIG Private Car SATP Adapter Draft

This source-cited adapter draft is not an approved commission rule or final payout.

## Source identity

- Workbook: Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx
- Path: `raters/tata-aig/march-2026/Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx`
- SHA-256: `c62b657e7d819a250cb86549c177f88ff0277835d39a2a3e0d337fdc9915f879`
- Byte size: 1479629
- Source-period label: not present in IR
- Effective date status: UNKNOWN
- Manifest/source identity verification: PASS

## Workbook inventory

- Sheets: 7
- Hidden sheets: 2
- Pvtcar serialized matrix: 566 rows / 36536 populated cells
- Formula cells preserved: 93166
- Formula cells with cached values preserved separately: 32621
- Error cells preserved separately: 10
- Merged ranges in IR: 0
- Approved commission rules emitted: 0

### Sheets

| Order | Sheet | Visibility | Scope | Dimension | Cells | Formulas | Cached | Errors | Merges |
|---:|---|---|---|---|---:|---:|---:|---:|---:|
| 1 | General Guidelines | VISIBLE | GUIDELINES_AND_PRIORITY | B1:C19 | 28 | 0 | 0 | 0 | 0 |
| 2 | cv checks | HIDDEN | HIDDEN_CACHED_CHECKS | A3:DM970 | 112229 | 46368 | 16954 | 0 | 0 |
| 3 | pci checks | HIDDEN | HIDDEN_CACHED_CHECKS | A3:DL1012 | 113062 | 45792 | 14668 | 0 | 0 |
| 4 | Pvtcar | VISIBLE | BASE_PRIVATE_CAR_GRID | A1:BR567 | 36536 | 620 | 619 | 5 | 0 |
| 5 | CV | VISIBLE | OUT_OF_SCOPE_COMMERCIAL_VEHICLE_GRID | A1:BQ124 | 8086 | 290 | 290 | 0 | 0 |
| 6 | TW | VISIBLE | OUT_OF_SCOPE_TWO_WHEELER_GRID | A1:DO29 | 1862 | 91 | 85 | 0 | 0 |
| 7 | Pvtcar_Extended Warranty | VISIBLE | OUT_OF_SCOPE_EXTENDED_WARRANTY_GRID | A3:BI170 | 9996 | 5 | 5 | 5 | 0 |

## Pvtcar matrix coverage

- Status: COMPLETE_FOR_SERIALIZED_IR
- Serialized IR dimension: A1:BR567
- Phase 0 documented dimension: A1:BR568
- Boundary discrepancy: yes
- Note: Every non-empty cell in the serialized Pvtcar IR has been retained. The final serialized cell row is 567; no claim is made about cells absent from the IR.
- All non-empty cells in the serialized IR are retained with exact sheet/cell citations.
- Column header ancestry is derived from the serialized row-1-to-row-5 cells and any serialized merged ranges. No merged ranges were reported by this IR.

## Sample base-grid trace

- Policy class: PRIVATE_CAR_SATP
- Body type: Hatch Back; grid-Type mapping: NOT_ASSERTED
- Known dimensions: Renewal / CNG / SATP / NCB All / Add On All / DELHI
- Candidate rows retained: 511 (Compact), 515 (MPV SUV), 519 (Mid Size), 523 (Ultra High End), 527 (Mini), 531 (High End), 535 (Quadricycle)
- Candidate values: 38.0% at Pvtcar!V511, 38.0% at Pvtcar!V515, 38.0% at Pvtcar!V519, 38.0% at Pvtcar!V523, 38.0% at Pvtcar!V527, 38.0% at Pvtcar!V531, 38.0% at Pvtcar!V535
- Base candidate: 38.0% on NET_PREMIUM
- Intermediary code: 721; override record: not supplied
- Net premium: INR 2154; GST INR 388 is separate
- Anchor: issue date NOT_ESTABLISHED; insurer login date UNKNOWN; cover start 2026-04-01 is not substituted
- Same-insurer renewal: yes; coverage gap retained as context (previous expiry 2024-08-30)
- Final base commission: not approved
- All-in payout: PENDING
- OD applicability: NOT_APPLICABLE

## Independent override hierarchies

- Owner high-level hierarchy: Special Deal → Specific Sub-segment → Standard Grid.
- Detailed workbook specificity: Policy-specific → Fleet-code → PAN-specific → Code-specific → Standard Grid.
- Mapping between these hierarchies: not defined; they remain independent.
- Override data status: not supplied.
- General Guidelines!C17 appears inconsistent with the detailed C12:C16 order; it is preserved as a source inconsistency.

## Date and payout stages

- **DATE_ANCHOR: PENDING.** A verified policy issue date or insurer-defined login-date requirement is not established by the available source IR.
- **ACTIVE_GRID_VERSION: PENDING.** The grid IR effective-date status is UNKNOWN; the month-specific version cannot be selected without a verified anchor.
- **OVERRIDE_SELECTION: PENDING.** No policy-, fleet-, PAN-, code-specific override records or authoritative no-override confirmation are supplied.
- **INCREMENTAL_COA: PENDING.** Producer GWP, current slab, increment value/basis, and base-rule all-inclusive status are unavailable; stale pivot zeros are not used.
- **GROSS_PAYOUT: PENDING.** A candidate base rate is not an all-in payout; the date, override, and incremental COA stages are pending.
- **SETTLEMENT: PENDING.** No signed settlement entries or authoritative accounting semantics are available; tax/clawback adjustments are not calculated.

## Incremental COA

- Status: PENDING_INSUFFICIENT_EVIDENCE
- Source mentions: General Guidelines!C5, Pvtcar!F3
- No GWP slab or increment was normalized because the Phase 2A IR/source evidence is insufficient.
- The old pci checks pivot cache is excluded as current COA evidence; its cached zeros do not mean 0% or no increment.
- Stale pivot context: source `Pvtcar!G5:BO131`, refresh 2024-04-23; cited Phase 0 extent A1:BR568.
- Missing: ACTIVE_POLICY_DATE_OR_INSURER_DEFINED_LOGIN_DATE, CURRENT_GWP_SLAB_THRESHOLDS, PRODUCER_GWP_AND_MEASUREMENT_WINDOW, INCREMENT_VALUE_AND_BASIS, BASE_RULE_ALL_INCLUSIVE_STATUS, ELIGIBILITY_AND_OVERRIDE_EVIDENCE

## Warnings

- **SHEET_BOUNDARY_DISCREPANCY (WARNING):** Phase 2A Pvtcar IR dimension is A1:BR567; Phase 0 documentation records A1:BR568. The adapter preserves only serialized IR cells through row 567 and does not reopen the workbook to reconcile the boundary.
- **STALE_PCI_CHECKS_NOT_COA_EVIDENCE (WARNING):** The Phase 0 rulebook identifies the pci checks cached pivot as stale/out of range. Its cached zeros are excluded as current incremental COA evidence; Phase 2A IR does not include pivot-cache source metadata.
- **ACTIVE_GRID_DATE_UNRESOLVED (WARNING):** The IR has no explicit effective date. Pvtcar!F1 states an applicability threshold, but the sample issue/login anchor and active month-specific version are not established by this grid IR.
- **COA_INPUTS_MISSING (WARNING):** The source only establishes that GWP-based incremental COA exists; no validated slab thresholds, producer GWP, increment amount/basis, or all-inclusive status is available for this sample.

## Provenance

- Source-derived workbook values, project-owner clarifications, and sample policy facts are tagged separately in the JSON.
- Formula expressions, cached values, and error codes are stored as distinct fields for all inventoried sheet cells containing formulas or errors.
- Phase 2A IR was the sole workbook input. The adapter does not open XLSX files, import ExcelJS, or calculate formulas.

