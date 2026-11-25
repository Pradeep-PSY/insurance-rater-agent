# Reliance IndusInd – Private Car Adapter Specification

**Adapter scope:** Reliance IndusInd Private Car grid ingestion and adapter-specific draft normalization.

**Research status:** Source mappings and conditional base-rate path are documented. The supplied grid is not temporally applicable to the supplied December 2025 policy. Some product/add-on terms remain unresolved and must not be applied.

---

## 1. Source identity and integrity

### Original workbook

- Original path in source corpus: `raters/reliance-indusind/feb-2026/Reliance Broking Premier  FEB 26 Grid.xlsx`
- Manifest bytes: `1,928,494`
- Manifest SHA-256: `50cd340b3ea5917d4fc6d55e720c14405f26d5076c059414b69a6c03ea7b3142`
- Workbook/file label: `FEB 26`
- Main private-car sheet title: `Pvt Car Old Business Grid - Jan-26`
- Effective-from/effective-to dates: **not explicitly established by the supplied evidence**.

Store the filename period label and sheet title period label separately. Neither label alone is a precise effective-date interval. Do not silently convert `Jan-26` or `FEB 26` into fabricated `effectiveFrom` / `effectiveTo` dates.

### Workbook sheets

The original OOXML workbook has eight visible sheets:

| Sheet | Dimensions | Merged ranges | Adapter treatment |
|---|---|---:|---|
| `FEB'26 - Grid` | `A1:AU76` | 35 | Inspect as a master/index/possible override source; do not ignore or assume its role. |
| `TW SCOOTER GRID` | `A1:AA16` | 11 | Inventory; out of private-car product scope unless the sheet explicitly references private-car rules. |
| `PRIVATE CAR COMP, SAOD & STP` | `A1:Q17` | 11 | Primary private-car base-rate matrix and H2:H6 terms. |
| `Short Term Taxi` | `A1` | 0 | Empty sheet; record as empty, no rules. |
| `Enabler, PO Guidelines & T&C` | `A3:J62` | 38 | Inspect all content for eligibility, instructions, hierarchy, and adjustments. |
| `Contest` | `A1` | 0 | Empty sheet; record as empty, no rules. |
| `RTO List` | `A1:E1502` | 0 | RTO/geography mappings. |
| `Make Model wise segment` | `A1:C536` | 0 | Make/model-to-segment mapping. |

All sheet names must be preserved exactly, including punctuation and spaces. Do not rename sheets in source locators.

The workbook has a defined name for the RTO master range:
`RTO List!$A$1:$E$1502`.
The defined name/filter range on `FEB'26 - Grid` covers `A4:AU76`. Preserve relevant workbook-level metadata if the Phase 2A IR exposes it.

---

## 2. Supplied Reliance sample policy facts

Source: `sample-policies/pvt-car-comprehensive-reliance.pdf`.

| Fact | Value | Source |
|---|---|---|
| Current insurer | Reliance General Insurance | Policy page 2 |
| Proposal/business wording | “Renewal of Policy” selected | Proposal form page 9 |
| Existing Reliance customer checkbox | No | Proposal form page 9 |
| Previous insurer | Not identified in inspected policy pages | Do not infer |
| Policy issue/invoice date | 12-Dec-2025 06:00 | Policy page 2 |
| Policy period | 23-Dec-2025 to 22-Dec-2026 | Policy page 2 |
| Vehicle | Renault Kwid 1.0 RXT O | Policy page 2 |
| RTO/location | UP-16, Noida, Uttar Pradesh | Policy page 2 |
| Engine capacity | 999 CC | Policy page 2 |
| Manufacture month/year | Oct-2020 | Policy page 2 |
| NCB deduction | 25% | Policy page 2 |
| Total OD premium | ₹4,714.00 | Policy page 2 |
| Total basic liability premium | ₹2,094.00 | Policy page 2 |
| PA benefits | ₹375.00 | Policy page 2 |
| Legal liability to paid driver | ₹50.00 | Policy page 2 |
| Total liability premium | ₹2,519.00 | Policy page 2 |
| Total package premium | ₹7,233.00 | Policy page 2 |
| IGST | ₹1,302.00 | Policy page 2 |
| Total payable | ₹8,535.00 | Policy page 2 |

### Critical interpretation constraints

1. Preserve the proposal form's explicit `Renewal of Policy` selection as a proposal/business wording fact.
2. Preserve `existing Reliance General customer = No` as a separate checkbox fact.
3. Previous insurer remains missing. Do not infer that the previous insurer was Reliance from the current insurer name or customer checkbox.
4. The policy PDF does not explicitly state fuel in the inspected schedule. An external vehicle reference may corroborate Petrol, but unless an approved vehicle-master source is configured, fuel remains unverified. Do not represent an external inference as policy evidence.
5. Store the invalid/absent state of any malformed manufacture-date sentinel if encountered; do not synthesize dates.
6. The sample's date is `2025-12-12`, which is earlier than the supplied January/February 2026-labelled grid. The sample's final commission status must be `UNSUPPORTED` due to no temporally applicable grid in the supplied corpus.

---

## 3. RTO mapping

Relevant sheet: `RTO List`.

For the sample mapping, the rulebook identifies:

- Exact source range: `RTO List!A1253:E1253`
- Input registration prefix: `UP16` (normalize policy display `UP-16` to comparison key `UP16`)
- Region City: `Delhi`
- Market Type: `T20`
- Zone: `NORTH`

Adapter requirements:

- Normalize RTO punctuation/spacing only for comparison; preserve original raw code and canonical comparison key.
- Extract all RTO mapping rows in the source table, not just `UP16`.
- Preserve all source columns, including any additional mapping attributes.
- Preserve duplicate/conflicting mappings; never silently deduplicate.
- Emit mapping candidates and explicit `CONFLICT` / `NOT_FOUND` outcomes where applicable.
- Cite the exact source row/range for every mapping.
- Do not assume `Region City`, `Market Type`, or `Zone` are interchangeable.

---

## 4. Make/model mapping

Relevant sheet: `Make Model wise segment`.

Sample mapping:

- Exact source range: `Make Model wise segment!A397:C397`
- Make: `RENAULT`
- Model: `KWID`
- Vehicle Segment: `SMALL`

Important: the visible private-car rate matrix does not have a `SMALL` column. Preserve `SMALL` as supporting mapping metadata, but do not invent a rate adjustment or make it a rate lookup dimension unless another authoritative source explicitly references it.

Adapter requirements:

- Normalize make/model only for comparison; preserve raw strings.
- Extract all rows and preserve source locators.
- Preserve variants/aliases only when explicitly present in source.
- Surface conflicting or duplicate make/model mappings.
- Do not infer missing fuel from make/model mapping.

---

## 5. Private-car rate matrix

Relevant sheet: `PRIVATE CAR COMP, SAOD & STP`.

The sample's row is documented as `A11:F11`, corresponding to `NORTH / Delhi`.

Known source values:

| Cell | Source meaning | Raw value / source interpretation |
|---|---|---:|
| `C11` | Petrol/Bifuel/Comp | `22.5` (candidate rate: 22.5%) |
| `D11` | Diesel/EV/Comp | `10` (candidate rate: 10%) |
| `E11` | SA OD | `20` (candidate rate: 20%) |
| `F11` | STP | `0` (explicit source value; preserve as zero, do not convert to missing or N/A) |

The complete row `A11:F11` must be preserved with its row labels, merged-header context, source values, number formats, and coordinates. The adapter must normalize the **complete private-car matrix in scope**, not hardcode row 11 or only the sample candidate.

Because the sheet uses merged headers, the adapter must reconstruct header ancestry without losing the original merged ranges or source coordinates. If the Phase 2A IR does not carry enough information to reliably reconstruct header context, stop and report the Phase 2A IR gap; do not parse the workbook again inside the adapter.

### Payout basis

`PRIVATE CAR COMP, SAOD & STP!H2` states that payout is made on **OD Premium**.

Represent this as a source-cited payout-basis instruction. Do not use total package premium as the payout basis for this Reliance grid.

The sample's OD premium is ₹4,714.00, but no commission amount/rate may be finalized for the sample because its date is outside the supplied grid's supported period and fuel is not policy-verified.

---

## 6. Effective-date selection

The project owner clarified that a February 2026 payout/commission grid should generally not be applied to a policy issued in December 2025.

For Reliance:

1. Default date anchor is policy issue date.
2. Use login/proposal date only if an authoritative Reliance source explicitly requires it.
3. Record which anchor was selected and the evidence/source that establishes the anchor rule.
4. Store source-period labels separately:
   - workbook/file label: `FEB 26`;
   - private-car sheet title: `Pvt Car Old Business Grid - Jan-26`.
5. Effective bounds are currently unknown/unverified. Do not synthesize precise dates from labels.
6. For the supplied sample:
   - policy issue date: `2025-12-12`;
   - supplied workbook/sheet labels are January/February 2026;
   - no December 2025 grid or retrospective applicability instruction is in the supplied corpus.
7. Therefore sample `gridApplicability = NOT_COVERED_FROM_AVAILABLE_EVIDENCE` and sample decision is `UNSUPPORTED`.
8. Do not return 22.5%, 21.375%, or any amount as the sample's final rate.
9. Do not silently use the latest available grid.

The adapter draft should preserve the workbook and sheet labels while explicitly keeping `effectiveFrom` and `effectiveTo` unknown.

---

## 7. `<1000 CC` adjustment

Source note: `PRIVATE CAR COMP, SAOD & STP!H3` states that for `<1000 CC`, PO will be 5% lesser than the above grid.

**Project-owner clarification (23-Nov-2026):** “5% lesser” means a relative rate reduction, not subtraction of five percentage points.

Formula:

`adjustedRate = baseRate × 0.95`

Example:
- Base rate 20% → adjusted rate 19%.
- If a future temporally valid rule has base rate 22.5%, conditional adjusted candidate is 21.375%.

Represent the operation as:

- operation: `MULTIPLY_RATE`
- factor: decimal string `"0.95"`
- condition: engine capacity `< 1000`
- source locator: `PRIVATE CAR COMP, SAOD & STP!H3`
- interpretation provenance: `PROJECT_OWNER_CLARIFICATION`
- clarification date: `2026-11-23`

Do not encode this as minus five percentage points.

For the supplied 999 CC sample, the condition is true, but the sample's rate must remain unsupported because the available grid is not temporally applicable. The conditional example is not the sample's final answer.

---

## 8. Additional conditions and adjustments

Source cells: `PRIVATE CAR COMP, SAOD & STP!H2:H6`.

| Cell | Original wording/meaning | Adapter handling |
|---|---|---|
| `H2` | Payout on OD Premium | Normalize as payout-basis instruction. |
| `H3` | `<1000 CC` PO 5% lesser | Normalize as relative multiplier `0.95`, with project-owner interpretation provenance. |
| `H4` | Standalone ZD policies: reduce 2.5% | Preserve as `UNRESOLVED_ADJUSTMENT`. Exact relative-vs-percentage-point operation and basis are not established. |
| `H5` | Extended Warranty: flat 20% payout | Preserve raw term and a candidate percentage value `20`, but payout basis/operation/eligibility must remain unresolved unless other authoritative source content establishes them. |
| `H6` | Tyre/RTI bundle, if sourced: 2.5% additional payout | Preserve as incremental payout candidate with sourcing condition; exact basis/operation and eligibility evidence must be explicit before application. |

Do not:
- apply H4 without ZD policy/add-on evidence;
- silently interpret H4 as a relative factor or percentage-point deduction;
- calculate H5 against an assumed premium basis;
- apply H6 without source/sourcing evidence;
- treat all terms as universally applicable to every private-car policy.

Inspect the complete `Enabler, PO Guidelines & T&C` sheet and `FEB'26 - Grid` sheet for corroborating conditions, exceptions, precedence, product definitions, or special deals. Preserve all relevant terms and citations. If these sheets conflict with the rulebook summary, report the conflict rather than silently choosing one.

---

## 9. Whole-workbook inspection requirements

The adapter must account for all 8 sheets:

1. `FEB'26 - Grid`
2. `TW SCOOTER GRID`
3. `PRIVATE CAR COMP, SAOD & STP`
4. `Short Term Taxi`
5. `Enabler, PO Guidelines & T&C`
6. `Contest`
7. `RTO List`
8. `Make Model wise segment`

Expected dimensions/merge counts from original workbook inspection:

| Sheet | Dimension | Merged ranges |
|---|---|---:|
| `FEB'26 - Grid` | `A1:AU76` | 35 |
| `TW SCOOTER GRID` | `A1:AA16` | 11 |
| `PRIVATE CAR COMP, SAOD & STP` | `A1:Q17` | 11 |
| `Short Term Taxi` | `A1` | 0 |
| `Enabler, PO Guidelines & T&C` | `A3:J62` | 38 |
| `Contest` | `A1` | 0 |
| `RTO List` | `A1:E1502` | 0 |
| `Make Model wise segment` | `A1:C536` | 0 |

These dimensions are validation expectations, not constants to hardcode into rules. Recompute observed counts from Phase 2A IR and report mismatches.

`Short Term Taxi` and `Contest` are empty. Preserve the empty-sheet inventory. `TW SCOOTER GRID` is out of scope for this private-car adapter, but its presence must be reported.

The `FEB'26 - Grid` sheet must be inspected, not ignored. It may hold master/index/producer-specific or override information. Adapter should identify its content and relevance, and preserve unresolved/unclassified sections for review.

---

## 10. Adapter-specific draft output

Because Phase 1 P0 schema defects are intentionally deferred, do not modify Phase 1 or force unresolved Reliance terms into current canonical contracts.

Create a Reliance-specific Zod-validated adapter draft, e.g. `ReliancePrivateCarAdapterDraft`.

It should contain:

### `sourceIdentity`
- insurer ID `RELIANCE_INDUSIND`;
- exact filename and relative path;
- SHA-256 and byte count from manifest;
- source-period filename label `FEB 26`;
- private-car sheet title label `Jan-26`;
- effective-date status `UNKNOWN_OR_UNVERIFIED`.

### `workbookInventory`
- all eight sheets;
- sheet state, dimensions, merged ranges, empty status;
- relevant source ranges;
- formula/cache/error metadata if present in IR;
- adapter scope classification and rationale per sheet.

### `rtoMappings[]`
- raw RTO;
- normalized comparison key;
- region/city;
- market type;
- zone;
- source locator;
- mapping status and duplicate/conflict references.

### `makeModelMappings[]`
- raw/canonical make and model;
- segment;
- source locator;
- mapping status;
- note whether the mapped segment is used by the rate matrix.

### `baseGridRows[]`
- source row;
- region/city or applicable row dimensions;
- complete product columns and raw values;
- reconstructed merged-header ancestry;
- number format/display metadata;
- source locators for each value;
- candidate/eligibility status.

### `termsAndAdjustments[]`
- raw wording;
- normalized term type;
- known conditions;
- operation/basis if established;
- unresolved semantic fields;
- interpretation provenance;
- exact cell/source locator.

### `sampleResolutionTrace`
- policy issue date and date-anchor decision;
- grid source period labels;
- applicability `NOT_COVERED_FROM_AVAILABLE_EVIDENCE`;
- sample policy facts with fact provenance;
- RTO mapping `UP16 → Delhi / T20 / NORTH`;
- make/model mapping `RENAULT / KWID → SMALL`;
- fuel remains unverified absent approved external vehicle-master evidence;
- base-grid conditional candidate values, clearly labelled non-final;
- `<1000 CC` relative-adjustment condition and factor `0.95`;
- final status `UNSUPPORTED`;
- no final OD/TP/package commission rate and no rupee payout amount.

### `warnings[]` and `validationSummary`
- missing effective-date bounds;
- policy fuel not explicitly present;
- previous insurer missing;
- segment `SMALL` not present as a base-grid column;
- unresolved ZD/EW/Tyre/RTI terms;
- any source parsing/header reconstruction limitations.

Do not create approved production commission rules from this draft.

---

## 11. Minimum automated tests

Use real-corpus tests against the Phase 2A `GridDocumentIR` artifact and synthetic tests for edge cases.

1. Exact source workbook identity, SHA-256 and byte count.
2. All eight exact sheet names are accounted for.
3. Empty sheets are reported as empty.
4. Merged ranges/header ancestry are preserved for grid sheets.
5. `RTO List!A1253:E1253` resolves `UP16 → Delhi / T20 / NORTH`.
6. Entire RTO mapping table is extracted dynamically; count is not hardcoded.
7. Duplicate/conflicting RTO mappings are surfaced.
8. `Make Model wise segment!A397:C397` resolves `RENAULT / KWID → SMALL`.
9. Entire make/model table is extracted dynamically.
10. `SMALL` is preserved but not used as a base-rate column.
11. Complete private-car matrix is extracted, not just row 11.
12. `C11`, `D11`, `E11`, `F11` raw values and source locators are preserved.
13. Explicit `F11 = 0` remains a source zero, not missing/N/A.
14. `H2` payout basis is OD Premium.
15. `H3` uses relative multiplier `0.95`, not minus five percentage points.
16. H4 remains unresolved and is not applied.
17. H5 remains conditional/unresolved unless basis and operation are proven.
18. H6 remains conditional on source/sourcing evidence and unresolved basis.
19. Workbook and sheet period labels are distinct; no invented effective bounds.
20. December 2025 sample returns unsupported due to no applicable grid evidence.
21. No fallback to the latest available grid.
22. Proposal renewal wording is preserved separately from missing previous insurer.
23. “Existing Reliance customer = No” is not used as previous-insurer evidence.
24. Fuel remains unverified unless an approved external source is explicitly supplied.
25. OD Premium is the payout basis, not total package premium.
26. No commission amount/rate is issued as the sample's final result.
27. Formula/number-format metadata, if present, is preserved without recalculation.
28. Adapter handles missing/ambiguous mappings and zero/multiple row candidates explicitly.
29. All emitted values retain exact Excel source locators.
30. No approved production rule bundle is emitted.

---

## 12. Architecture and implementation boundaries

- Inspect the existing Go Digit adapter under `phase-2b/` and follow its conventions where appropriate.
- Create an isolated Reliance package at `phase-2b-reliance/` (do not mix its files with the Go Digit package).
- Consume Phase 2A `GridDocumentIR` or its serialized inventory equivalent.
- Do not import ExcelJS or PDF.js into the Reliance adapter.
- Do not reparse the original workbook inside the adapter.
- If Phase 2A IR is insufficient for merged header reconstruction or source-cell provenance, stop and report the exact IR gap; request approval for a Phase 2A change rather than reopening XLSX inside the adapter.
- Do not modify Phase 0 source documents, `MANIFEST.json`, Phase 1, Phase 2A, or the Go Digit adapter.
- Do not fix deferred Phase 1 P0 contract defects.
- Do not implement HDFC or Tata AIG adapters.
- Do not implement the runtime rating engine.
- Do not emit approved canonical commission rules.
- Do not hardcode sample-specific answers or choose rows by sample filename.
- Preserve all unresolved source semantics explicitly.

---

## 13. Definition of done

The Reliance adapter is complete only when:

- It consumes actual Phase 2A IR from the verified source workbook.
- All eight sheets are accounted for and relevant private-car content is normalized.
- Full RTO and make/model mapping tables are extracted with citations.
- The full private-car matrix is normalized with merged-header context.
- H2:H6 terms are represented faithfully with unresolved semantics preserved.
- The `0.95` relative adjustment is supported by project-owner clarification provenance.
- The sample's date applicability is `NOT_COVERED_FROM_AVAILABLE_EVIDENCE`, so its final result is `UNSUPPORTED`.
- No 22.5% or 21.375% is emitted as the December 2025 sample's final commission.
- Tests, typecheck, and build pass with actual commands/results documented.
- No Phase 0/1/2A/Go Digit source files or original workbook are modified.
