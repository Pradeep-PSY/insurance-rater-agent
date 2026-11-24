# Insurance Rater Agent – Phase 0 Final Research Report

**Report date:** 23-Nov-2026  
**Source bundle:** `insurance-rater-agent-challenge.zip`  
**Status:** Initial research and owner-clarification pass complete. Some insurer-specific rate semantics and runtime inputs remain explicitly unresolved.

## 1. Executive summary

The supplied starter bundle contains four synthetic policy PDFs, three insurer Excel grids, one HDFC ERGO commission-grid PDF, and challenge documentation/manifest. All 10 source files listed in the manifest passed byte-size and SHA-256 verification.

The four insurer lookup paths are sufficiently understood to define Phase 1's generic contracts, but they must not all be represented as a simple `{odRate, tpRate}` pair. The research reveals several distinct calculation models:

- HDFC ERGO: one Package rate applied to total Net Premium (OD + TP/liability), GST excluded, per project-owner clarification.
- Go Digit: the matched SATP row contains a percentage-formatted `Max CD2` field, but the owner has asked us to skip its semantic interpretation. No TP commission rate is approved.
- Reliance IndusInd: the supplied Jan/Feb-2026 grid is later than the Dec-2025 sample policy and must not be applied. If a valid grid is found, the `<1000 CC` adjustment is a relative 5% reduction (`base × 0.95`).
- Tata AIG: the base SATP rate candidate is 38% on Net Premium. An issue/login-date check, override check, and incremental COA calculation are required before all-in payout can be finalized.

## 2. Bundle inventory and integrity

| Item | Count | Notes |
|---|---:|---|
| Sample motor policy PDFs | 4 | HDFC ERGO, Go Digit, Reliance, Tata AIG |
| Excel commission grids | 3 | Go Digit, Reliance IndusInd, Tata AIG |
| HDFC ERGO commission grid PDFs | 1 | Two-page grid, effective 1-Feb-2025 |
| Documentation / manifest | 3 | README, challenge.md, MANIFEST.json |
| Total files | 11 | 10 source files listed in manifest plus package structure as delivered |

All 10 files listed in `MANIFEST.json` match their expected byte sizes and SHA-256 values.

### Extraction observations

- All four supplied sample policy PDFs are image/scanned-based in the inspected pages. Normal text extraction does not return the required policy facts; OCR or visual/document extraction is necessary.
- HDFC ERGO's two-page rate-card PDF contains extractable text/tables.
- Go Digit and Reliance Excel files were inspected at workbook/sheet/cell level; parser compatibility should not be confused with a source-data defect.
- Tata AIG has hidden check sheets. The hidden `pci checks` cached pivot is stale/out of range relative to the current Pvtcar rows and must not be used as proof of a zero incremental COA for the matching rows.

## 3. Cross-insurer result summary

| Insurer | Policy class | Main lookup path | Base/source finding | Current decision status |
|---|---|---|---|---|
| HDFC ERGO | Comprehensive | Haryana → Zone 2 → Package → `>10k–50k` → Non-Petrol → NCB | Package rate 17.50% | Package-rate candidate identified; basis clarified. Fuel has external provenance, not policy evidence. |
| Go Digit | Stand-alone TP | UP78 → 4WTP `UP_Bad` → Petrol>1000 → Age All | `4W SATP!E293` raw `Max CD2=0.295`, formatted 29.5% | Ambiguous/withheld; do not emit as TP commission because field meaning is undefined and owner asked to skip it. |
| Reliance IndusInd | Comprehensive | UP16 → Delhi / NORTH; Renault Kwid → SMALL; Delhi Petrol/Comp base row | Base grid candidate 22.5%; `<1000 CC` conditional factor 0.95 gives 21.375% | Unsupported for the sample: supplied Jan/Feb-2026 grid is later than the 12-Dec-2025 policy issue date. Do not apply retroactively. |
| Tata AIG | Stand-alone TP | Delhi + CNG + Renewal + SATP; all seven Type rows invariant | Base standard-grid candidate 38.0% on Net Premium | Base candidate found; all-in gross payout unresolved pending issue/login anchor, higher-priority overrides and incremental COA. |

These values are not interchangeable. A candidate/base rate must not be presented as a final all-in payout when the source requires more steps.

## 4. Project-owner clarifications received on 23-Nov-2026

### 4.1 HDFC ERGO – Package rate meaning

The owner clarified that a Package Rate is applied to the full policy Net Premium:

```text
package_net_premium = OD_net_premium + TP_or_liability_net_premium
package_commission = package_net_premium × package_rate
```

GST is excluded from the premium basis. When a Package Rate is published, there is no additional separate TP percentage. When the grid instead publishes separate OD and TP rates, those rates apply to their respective premium components.

For the supplied HDFC policy:

- OD net premium: ₹8,053.
- Liability net premium: ₹3,816.
- Total package net premium: ₹11,869.
- GST: ₹2,136 (excluded from commission basis).
- Candidate Package rate: 17.50%.

Optional arithmetic gives ₹2,077.075 before rounding, but the challenge requires the percentage and any amount should use an explicit currency-rounding rule.

**Phase 1 impact:** The result/data contract must support `rateScope = package`, `premiumBasis = total_net_package_premium`, and component rates that are `not_separately_specified`. Do not force this into an OD-only or TP-only rate.

### 4.2 Go Digit – Max CD2

The owner could not find an authoritative definition for `Max CD2` and directed us to skip its semantic interpretation.

**Phase 1 impact:** Preserve the raw value and source cell for audit. Do not normalize it to broker commission or publish 29.5% as the TP commission. The sample result should remain ambiguous/withheld until the field's meaning is authoritatively defined.

### 4.3 Reliance IndusInd – “5% lesser”

The owner clarified that “5% lesser” means a relative reduction of the base rate, not subtraction of five percentage points:

```text
adjusted_rate = base_rate × 0.95
```

For the workbook's 22.5% candidate base rate, the conditional adjusted rate is 21.375%. This is an illustrative future-valid-grid computation, not the sample's final answer because the available rate card is later than the sample policy.

### 4.4 Reliance IndusInd – grid date

The owner confirmed that the February 2026 grid should generally not be applied to a policy issued in December 2025. Use the grid valid for the policy issue period, unless an explicit insurer rule defines a different anchor or retrospective applicability.

**Phase 1 impact:** Implement grid-version selection using policy issuance date, or an explicitly defined login/proposal date. Never pick the latest grid just because it is the only supplied file.

### 4.5 Tata AIG – date, overrides, incremental COA, settlement

The owner clarified the operational sequence:

1. Select the active grid month using policy issuance date, or the insurer-defined login date if that is the required anchor.
2. Select the highest-priority matching rule: Special Deal → Specific Sub-segment → Standard Grid.
3. If the selected base rule is not all-inclusive, add eligible incremental COA. If it is all-inclusive, do not add it again.
4. Calculate gross payout.
5. Apply separately recorded TDS/GST accounting adjustments and prior clawbacks/endorsement reversals to derive net payable.

The Tata workbook itself gives a more detailed override order in `General Guidelines!C11:C16`: policy-specific → fleet-code → PAN-specific → code-specific → standard grid. Preserve this detailed order. The project-owner's high-level labels should be mapped to these detailed levels only when the mapping is known; do not conflate them silently.

**Phase 1 impact:** Separate base commission, incremental COA, gross payout, settlement adjustments and net payable. Exact adjustment signs/amounts and COA slab values still need authoritative data. GST must not be blindly treated as a deduction; encode its signed accounting treatment from an authoritative rule.

## 5. Insurer-by-insurer findings

### HDFC ERGO

- Policy issued 26-Mar-2026; current period 29-Mar-2026 to 28-Mar-2027.
- Vehicle: Mahindra Bolero Neo N10 (R), 1493 CC, HR-26/Gurgaon, manufacture year 2023.
- Previous insurer Tata AIG; current and previous insurer differ, so do not infer business type from the supplied same-insurer rule.
- Premium: OD net ₹8,053 + liability net ₹3,816 = total net package ₹11,869; GST ₹2,136 separately.
- HDFC grid effective 1-Feb-2025. Haryana maps to Zone 2 on grid page 2.
- Page 1 Package rate row `>10k–50k`; non-petrol NCB candidate is 17.50%, assuming approved Diesel classification. The policy itself does not visibly print fuel; external corroboration must remain separate.
- Owner clarified Package-rate payout basis: total Net Premium (OD + TP/liability), GST excluded. Do not add a separate TP rate to a Package rate.

### Go Digit

- Policy issued 24-Mar-2026; stand-alone liability-only cover 25-Mar-2026 to 24-Mar-2027.
- Vehicle Hyundai Santro New / 1.1 MT Corporate; Petrol; 1086 CC; UP78; Kanpur Nagar.
- Current and previous insurer are both Go Digit → Renewal under challenge rule.
- `4W  RTO!B1609:C1609`: UP78 → UP_Bad using the `4WTP` mapping column.
- `4W SATP!B293:F293`: UP_Bad + Petrol>1000 + Age All; `E293` raw `0.295` displayed 29.5%, field label `Max CD2`.
- Manufacture-year field is invalid (`0001-01-01`), but the matched age condition is `All`, so it does not block the row match.
- Owner instructed us to skip `Max CD2` interpretation. Keep it raw; do not output as TP commission. OD is not applicable.

### Reliance IndusInd

- Policy issue date 12-Dec-2025; cover 23-Dec-2025 to 22-Dec-2026.
- Vehicle Renault Kwid 1.0 RXT O, 999 CC, UP16/Noida, manufacture Oct-2020.
- Proposal form page 9 marks “Renewal of Policy”; it separately marks “Are you an existing Reliance General Insurance Customer?” as No. Previous insurer is not identified in inspected pages, so preserve proposal type as Renewal and do not infer previous insurer.
- RTO mapping `RTO List!A1253:E1253`: UP16 → Delhi / T20 / NORTH.
- Make-model mapping `Make Model wise segment!A397:C397`: RENAULT/KWID → SMALL; the visible base-rate table does not use a SMALL column.
- The available workbook is February 2026 and its private-car tab is Jan-26; it post-dates the policy. No retroactive-application instruction is supplied.
- Therefore the sample result is unsupported from this source set; do not publish 22.5% or 21.375% as its final rate.
- If a temporally valid grid later yields the same 22.5% base row and the `<1000 CC` condition applies, owner clarified relative adjustment `22.5% × 0.95 = 21.375%`.
- Grid `H2` states payout basis OD Premium.

### Tata AIG

- Policy wording: Auto Secure – Liability Only; cover 1-Apr-2026 to 31-Mar-2027.
- Vehicle Maruti Zen Estilo LXI CNG; CNG; 998 CC; Delhi, Zone A; manufacture year 2011.
- Current and previous insurer both Tata AIG → Renewal under challenge rule, despite the previous policy expiry being 30-Aug-2024.
- Net TP premium ₹2,154; GST ₹388; total ₹2,542.
- `General Guidelines!C7` and `Pvtcar!F2`: SATP rate applies on Net Premium.
- All seven Delhi / CNG / Renewal / SATP / NCB All / Add-on All candidate Type rows return 38% (`Pvtcar!V511`, `V515`, `V519`, `V523`, `V527`, `V531`, `V535`). The unknown Hatch Back-to-grid-Type mapping does not change this base rate for this specific combination.
- `General Guidelines!C11:C16` gives policy-specific → fleet-code → PAN-specific → code-specific → standard-grid order. The policy shows intermediary code 721, but no corresponding override dataset is supplied.
- Incremental COA is additionally applicable when eligible, unless the locked base rule is all-inclusive. The hidden `pci checks` pivot is stale/out of range and cannot prove a zero increment. GWP slab thresholds/value and relevant intermediary GWP input are missing.
- Gross payout and net settlement adjustments (TDS/GST, clawbacks, endorsement reversals) must be separate layers.
- Issue/login date is the version anchor per owner clarification; the policy cover start alone must not be substituted for the issue/login date without an explicit rule.

## 6. Phase 0 open items

| Insurer | Open item | Safe behavior until resolved |
|---|---|---|
| HDFC ERGO | Fuel is not printed in the policy; accept only approved external vehicle-master corroboration. Confirm the result UI can report a package-level rate without inventing OD/TP component rates. | Preserve fuel provenance; output Package scope and component rates not separately specified. |
| Go Digit | Meaning of `Max CD2`; explicit effective-from/effective-to date in source. | Preserve raw value; do not emit a TP commission percentage. |
| Reliance | Obtain grid valid for 12-Dec-2025 issue date; fuel absent on policy. | Return unsupported from supplied rate corpus; do not use Jan/Feb-2026 grid. |
| Tata AIG | Authoritative issue/login date; override data or proof no override; current GWP increment table/slabs and intermediary GWP; exact settlement/tax adjustment signs. | Show 38% as base candidate only; do not label as final all-in payout. |

## 7. Phase 1 data-contract implications

Phase 1 should not use a simplistic `odRate: number` / `tpRate: number` structure only. It must support at least:

1. **Rate scope:** `od`, `tp`, `package`, or a named insurer-defined field retained raw until interpreted.
2. **Premium basis:** `od_net_premium`, `tp_net_premium`, `total_net_package_premium`, or source-defined basis.
3. **Applicability:** `applicable`, `not_applicable`, and `not_separately_specified` (the latter is needed for a Package rate on comprehensive coverage).
4. **Rule version:** grid effective-from/to and anchor date (`policy_issue_date` or insurer-defined `login_date`).
5. **Adjustment operation:** explicit operators such as `multiply_rate_by 0.95`, `add_incremental_coa`, and clearly defined percentage-point changes; never parse ambiguous adjustment prose at runtime.
6. **Base/increment/settlement layers:** base commission, incremental COA, gross payout, signed settlement adjustments and net payable.
7. **Raw source fields:** preserve exact labels such as `Max CD2`, its cell value and cell number format even when semantics are unresolved.
8. **Evidence provenance:** policy page, OCR quote, grid PDF page/table, workbook/sheet/cell range, and external corroboration as distinct evidence types.
9. **Partial decisions:** permit one component or base calculation to be resolved while another stage is ambiguous/unsupported.
10. **Decision trace:** show version selection, overrides considered, mapping steps, matched conditions, rejected conditions, adjustments and source evidence.

## 8. Phase 0 exit assessment

**Completed:** bundle integrity, file inventory, first-pass inspection of all four sample policies and supplied grids, insurer lookup-path documentation, and incorporation of project-owner clarifications.

**Not fully closed:** Go Digit `Max CD2` semantics are intentionally skipped; Reliance lacks a temporally valid grid for its sample; Tata AIG lacks the inputs needed to resolve overrides and incremental COA; HDFC's fuel value depends on an approved external source if policy-only extraction is required.

This is sufficient to begin Phase 1 contract design, provided unresolved states are first-class in the schemas and tests. It is not sufficient to hardcode four final commission answers.
