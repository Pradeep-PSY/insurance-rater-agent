# Reliance IndusInd Private Car Adapter Draft

This source-cited adapter draft is not an approved commission rule or rating result.

## Source identity and applicability

- Workbook: Reliance Broking Premier  FEB 26 Grid.xlsx
- Path: `raters/reliance-indusind/feb-2026/Reliance Broking Premier  FEB 26 Grid.xlsx`
- SHA-256: `50cd340b3ea5917d4fc6d55e720c14405f26d5076c059414b69a6c03ea7b3142`
- Byte size: 1928494
- Workbook label: FEB 26 (filename label only)
- Private-car sheet title: Pvt Car Old Business Grid- Jan-26
- Sheet period label: Jan-26 (title label only)
- Effective bounds: unknown; no dates inferred from labels

## Workbook inventory

- Sheets: 8
- RTO mappings: 1501
- Make/model mappings: 535
- Private-car matrix rows: 15
- H2:H6 terms: 5
- Formula cells / formula errors: 0 / 0
- Approved commission rules emitted: 0

- FEB'26 - Grid: A1:AU76 (expected A1:AU76; matches: true), 35 merges, 3523 cells, MASTER_INDEX
- TW SCOOTER GRID: A1:AA16 (expected A1:AA16; matches: true), 11 merges, 216 cells, OUT_OF_SCOPE
- PRIVATE CAR COMP, SAOD & STP: A1:Q17 (expected A1:Q17; matches: true), 11 merges, 162 cells, PRIVATE_CAR_MATRIX
- Short Term Taxi: A1 (expected A1; matches: true), 0 merges, 0 cells, empty
- Enabler, PO Guidelines & T&C: A3:B62 (expected A3:J62; matches: false), 38 merges, 104 cells, TERMS
- Contest: A1 (expected A1; matches: true), 0 merges, 0 cells, empty
- RTO List: A1:E1502 (expected A1:E1502; matches: true), 0 merges, 7510 cells, RTO_MAP
- Make Model wise segment: A1:C536 (expected A1:C536; matches: true), 0 merges, 1608 cells, MAKE_MODEL_MAP

## Sample decision trace

- Status: UNSUPPORTED
- Reason: NO_TEMPORALLY_APPLICABLE_GRID
- Policy issue-date anchor: 2025-12-12
- Grid applicability: NOT_COVERED_FROM_AVAILABLE_EVIDENCE
- Latest-grid fallback used: false
- RTO mapping: UP16 → Delhi / T20 / NORTH
- Make/model mapping: RENAULT / KWID → SMALL (segment not used as a rate dimension)
- Fuel: UNVERIFIED; no approved vehicle-master evidence
- Previous insurer: MISSING; not inferred
- Conditional matrix candidate: A11:F11; rate values are not final
- <1000 CC relative adjustment factor: 0.95 (condition satisfied; not applied to unsupported sample)
- Final commission rate: withheld
- Final payout amount: withheld

## Source-specific terms

- PAYOUT_BASIS — payout will made on OD Premium (`PRIVATE CAR COMP, SAOD & STP!H2`)
- RELATIVE_ADJUSTMENT — Payout for < 1000 CC, PO will be 5% lesser than the above Grid (`PRIVATE CAR COMP, SAOD & STP!H3`)
- UNRESOLVED_ADJUSTMENT — Standlone ZD policies 2.5%will be redused from the above Grid (`PRIVATE CAR COMP, SAOD & STP!H4`)
- CONDITIONAL_FLAT_PAYOUT — EW of Pvivate car will be Flat 20% Payout (`PRIVATE CAR COMP, SAOD & STP!H5`)
- INCREMENTAL_PAYOUT — Addon Bundle (Tyre / RTI) if Sourced, 2.5% Additional Payout Shall be offered (`PRIVATE CAR COMP, SAOD & STP!H6`)

## Warnings

- EFFECTIVE_BOUNDS_UNKNOWN: The FEB 26 filename label and Jan-26 sheet title do not establish precise effective dates.
- POLICY_FUEL_UNVERIFIED: Fuel is not stated on the policy schedule and no approved external vehicle-master source was supplied.
- PREVIOUS_INSURER_MISSING: Previous insurer is not identified in the inspected policy pages and is not inferred.
- SMALL_SEGMENT_NOT_A_RATE_DIMENSION: SMALL is retained in the make/model mapping but is not a visible private-car matrix column.
- UNRESOLVED_ADJUSTMENT_TERMS: H4, H5, and H6 remain conditional/unresolved and are not applied.
- MASTER_GRID_PRIVATE_CAR_STP_ZERO_UNINTERPRETED: The separate PC STP Non-Diesel area contains explicit zero values; they are preserved raw and not interpreted as a commission rule or decline.
- ENABLER_SCOPE_UNRESOLVED: Enabler, hygiene, and synergy rows are retained with citations but their private-car applicability is not inferred or applied.
- PHASE_2A_DIMENSION_DIFFERS_FROM_SOURCE_EXPECTATION: Phase 2A dimension metadata differs from source inspection expectations: Enabler, PO Guidelines & T&C. Observed values are retained without rewriting the IR.

## Mapping / rate counts

- RTO rows retained: 1501
- Make/model rows retained: 535
- Base-grid rows retained: 15
- Master-grid raw cells retained: 3523
- Contextual enabler rows retained without application: 54
