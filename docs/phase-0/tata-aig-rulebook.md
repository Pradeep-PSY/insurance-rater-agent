# Tata AIG - Private Car Stand-alone TP Rulebook

**Research status:** Base standard-grid lookup identified. Project-owner clarifications now define date anchoring, override selection, incremental COA treatment, and the separation between gross payout and net settlement. The supplied workbook still does not contain enough current override/GWP inputs to calculate the sample’s fully loaded payout.

**Scope:** The supplied Tata AIG sample is a private-car stand-alone Third-Party (SATP) policy. This rulebook focuses on the `Pvtcar` standard grid and the policy's Delhi/CNG/Renewal/SATP lookup.

## 1. Source files

| Purpose | Source |
|---|---|
| Policy | `sample-policies/pvt-car-satp-tata-aig.pdf` |
| Commission grid | `raters/tata-aig/march-2026/Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx` |
| General instructions | `General Guidelines` |
| Private-car base rate matrix | `Pvtcar` |
| Hidden internal check sheet | `pci checks` (hidden) |

The workbook contains seven sheets. `cv checks` and `pci checks` are hidden. The `Pvtcar` sheet is the base standard-grid source for this sample.

## 2. Policy facts extracted from the supplied PDF

Source: `pvt-car-satp-tata-aig.pdf`.

| Fact | Extracted value | Source |
|---|---|---|
| Current insurer | Tata AIG General Insurance Company Limited | Pages 1, 4, 11 |
| Policy wording/type | Auto Secure - Liability Only Policy | Pages 1, 4 |
| Current TP cover period | 01-Apr-2026 to 31-Mar-2027 | Pages 1 and 11 |
| Registration number | DL 9C AB 2893 | Page 4 |
| RTO location | Delhi | Page 4 |
| Zone | A | Page 4 |
| Make/model/variant | Maruti / Zen Estilo / LXI CNG | Pages 4 and 11 |
| Body type | Hatch Back | Pages 4 and 11 |
| Fuel | CNG | Pages 4 and 11 |
| CC | 998 | Page 4 |
| Manufacture year | 2011 | Page 4 |
| Date of registration | 02-Nov-2011 | Page 4 |
| Previous insurer | Tata AIG General Insurance Co. Ltd. | Page 11 |
| Previous policy expiry | 30-Aug-2024 | Page 11 |
| Previous cover type | Package | Page 11 |
| Previous-policy claim | No | Page 11 |
| Previous NCB / NCB claimed | NA / NA | Page 11 |
| Basic TP premium | ₹2,094 | Page 5 |
| CNG/LPG kit TP premium | ₹60 | Page 5 |
| Total liability premium | ₹2,154 | Page 5 |
| Net Premium (B) | ₹2,154 | Page 5 |
| GST | ₹388 | Page 5 |
| Total policy premium | ₹2,542 | Pages 1 and 5 |
| Agent/intermediary code | 721 | Page 4 |

The previous policy expired on 30-Aug-2024, whereas the current TP cover starts on 01-Apr-2026. This is a material coverage gap. However, the challenge explicitly says that if the current and previous insurer are the same, classify the business type as **Renewal**. Apply that challenge rule; retain the gap as contextual evidence, not as a reason to silently reclassify the business.

## 3. General Guidelines that govern the lookup

The following cells are directly relevant:

| Cell | Source wording / meaning | Runtime consequence |
|---|---|---|
| `General Guidelines!C5` | Only base commission needs to be updated in the following sheet; additionally, a GWP-based rule for incremental COA has been created. | Separate base rate from possible incremental COA. Do not assume base rate is the all-in payout without checking the increment rule. |
| `General Guidelines!C7` | Pvt Car SATP payout percentage is on Net Premium; Package and SAOD are on OD premium. | This policy's SATP base percentage applies to Net Premium, not OD premium or GST-inclusive final premium. |
| `General Guidelines!C10` | For all policies, use the RTO mapped on the policy; for Brand New where RTO is unavailable, use the producer's branch RTO. | Use the policy's stated Delhi RTO/location. The Brand New fallback is not relevant to this renewal case. |
| `General Guidelines!C11:C16` | Calculation sequence: Policy specific -> Fleet code basis -> PAN specific -> Code specific -> Standard Grid. | Higher-priority overrides must be checked before the standard grid when their data is supplied. |
| `General Guidelines!C17` | “Producers not on covered in pt 6 a/b/c shall by default fall under standard grid.” | The wording does not fully align with the preceding a-e sequence because code-specific is item d. Preserve this as a source inconsistency; do not invent precedence. |
| `General Guidelines!C19` | Cancellation/endorsement business-slab premium is considered post-effect; payout percentage uses the month-specific percentage during the interim period. | Relevant to cancellation/endorsement cases, not this ordinary policy schedule. |

The `Pvtcar` sheet also states:

- `Pvtcar!F1`: Standard Grid for Pvt Car LOB is applicable from policies dated 1-Nov-2025.
- `Pvtcar!F2`: Package/SAOD percentage is on OD Premium; SATP percentage is on Net Premium.
- `Pvtcar!F3`: Below COA rates are base commission to be processed; a GWP-based incremental COA rule is also applicable.

The sample's TP cover starts 01-Apr-2026, which is after 01-Nov-2025. The project owner clarified that the active month must be selected by policy issue date, or by an insurer-defined login date where that is the required anchor. The issue/login date must be captured and checked; do not silently substitute the cover-start date. If the selected anchor is on/after 01-Nov-2025, the standard-grid effective-from condition is met, subject to any higher-priority override.

## 4. `Pvtcar` sheet structure

The relevant header cells are:

| Cell | Header |
|---|---|
| `Pvtcar!G5` | Type |
| `Pvtcar!H5` | Business Type |
| `Pvtcar!I5` | Fuel Type |
| `Pvtcar!J5` | Section Text |
| `Pvtcar!K5` | NCB |
| `Pvtcar!L5` | Add On |
| `Pvtcar!V5` | DELHI |

Therefore, the standard-grid key dimensions for this policy are:

- Type (one of the grid's vehicle categories)
- Business Type = Renewal
- Fuel Type = CNG
- Section Text = SATP
- NCB = All
- Add On = All
- Location column = DELHI (`V`)

The policy provides body type `Hatch Back`, but it does not directly provide one of the `Pvtcar` grid's Type values. The grid's seven Type categories are `Compact`, `MPV SUV`, `Mid Size`, `Ultra High End`, `Mini`, `High End`, and `Quadricycle`. No authoritative Hatchback-to-grid-Type mapping has been located in the supplied workbook.

### Rate-invariance resolution for the missing Type mapping

For the exact known dimensions `Renewal + CNG + SATP + NCB All + Add On All + DELHI`, all seven Type rows have the same base rate:

| Type | Source row | Delhi rate cell | Value |
|---|---:|---|---:|
| Compact | 511 | `Pvtcar!V511` | 38.0% |
| MPV SUV | 515 | `Pvtcar!V515` | 38.0% |
| Mid Size | 519 | `Pvtcar!V519` | 38.0% |
| Ultra High End | 523 | `Pvtcar!V523` | 38.0% |
| Mini | 527 | `Pvtcar!V527` | 38.0% |
| High End | 531 | `Pvtcar!V531` | 38.0% |
| Quadricycle | 535 | `Pvtcar!V535` | 38.0% |

Each value is stored as `0.38` and displayed using a percentage number format (`0.0%`).

**Safe conclusion:** Although the policy's exact grid Type category is not proven, the output is invariant across every Type category present in this rule family. The base standard-grid result is therefore uniquely **38.0%** without guessing the vehicle Type. The decision trace must show all seven candidate rows and their identical rates, rather than claiming that Hatch Back maps to Compact.

## 5. Sample-policy base lookup sequence

1. Identify insurer as Tata AIG.
2. Identify cover as private-car liability-only / SATP.
3. Read current RTO location `DELHI` and Zone `A` from policy page 4. The `Pvtcar` rate table's location column is `DELHI` (`V5`).
4. Compare current insurer and previous insurer. Both are Tata AIG; under the challenge's rule, business type = `Renewal`.
5. Extract fuel `CNG` from policy pages 4 and 11.
6. Select section `SATP` from the current policy wording.
7. NCB is not supplied as an active NCB percentage for this SATP policy, but the grid row dimension is `All`, so NCB does not restrict the match.
8. Add-on dimension is `All` in the matching grid rows.
9. Vehicle Type is not directly mapped. Evaluate all seven Type categories for this known condition set.
10. Each of the seven Delhi rows returns 38.0%; therefore the base standard-grid rate is unique.
11. Apply this SATP base rate to Net Premium, per `General Guidelines!C7` and `Pvtcar!F2`.

### Base-rate result

- OD: **Not applicable**.
- TP base standard-grid percentage: **38.0%**.
- Percentage basis: **Net Premium**.
- Policy Net Premium: ₹2,154 (policy page 5).
- Optional base-only amount arithmetic: ₹2,154 × 38.0% = ₹818.52. This is not an all-in amount if incremental COA or an override applies.

## 6. Overrides and incremental COA - unresolved control layer

### 6.1 Override precedence

The workbook lists this detailed order in `General Guidelines!C11:C16`:

1. Policy-specific
2. Fleet code basis
3. PAN-specific
4. Code-specific
5. Standard Grid

The project owner separately described the business-level selection as **Special Deal → Specific Sub-segment → Standard Grid**. Treat this as the high-level grouping. For implementation, retain the workbook's more detailed priority levels until the insurer confirms how each detailed override type maps into the two high-level groups.

The policy shows Agent/Intermediary Code `721` on page 4. The supplied workbook does not provide a clear producer/code-specific override record for this code, nor policy-specific/fleet/PAN override inputs. The standard grid is the only directly matchable rate table in the supplied source file set, but we cannot prove from this workbook alone that no external higher-priority override exists.

`General Guidelines!C17` refers to producers not covered under points 6 a/b/c defaulting to the standard grid. This appears inconsistent with the preceding sequence, which separately includes `d. Code specific`. Keep this inconsistency documented and do not silently rewrite the precedence hierarchy.

### 6.2 GWP-based incremental COA

`General Guidelines!C5` and `Pvtcar!F3` state that a GWP-based incremental COA rule exists in addition to base commission.

The supplied policy PDF does not contain the producer's relevant GWP/business-slab value. The workbook does not give an unambiguous slab-threshold mapping for this policy's GWP in the visible guideline cells.

The hidden `pci checks` sheet must not be used as proof of the current increment for this row without further validation:

- `pci checks` is hidden.
- Its cached pivot table source in `xl/pivotCache/pivotCacheDefinition2.xml` is `Pvtcar!G5:BO131`.
- The current `Pvtcar` worksheet extends to `A1:BR568`.
- The seven matching CNG/Renewal/SATP base-grid rows are 511, 515, 519, 523, 527, 531, and 535, all outside the pivot cache's stated source range.
- The cached pivot metadata has a refresh date of 2024-04-23, which predates the March 2026 workbook version.

Consequently, the hidden pivot/check output is stale or at least out of sync with the current base-grid rows. Cached zero values in `pci checks` must not be interpreted as proof that incremental COA is zero for this policy.

**Project-owner clarification supplied in chat (23-Nov-2026):** After choosing the applicable date/version and locking the highest-priority matching base rule, check the incremental COA rule. If the locked base rule is **not all-inclusive**, add any eligible incremental COA. If it is all-inclusive, do not add incremental COA again.

This clarifies the algorithmic sequence, but does not provide the actual GWP thresholds, eligible incremental percentage/amount, the policy/intermediary GWP slab, or a current validated incremental table for this sample. The hidden pivot remains stale/out of range and cannot be used to assert a zero increment.

**Required handling:** Store the verified base-rate candidate as 38.0%, but keep the all-in gross payout unresolved until the current GWP slab rule, incremental COA value, and relevant producer GWP input are available or authoritatively confirmed.

## 7. Runtime rule specification

```text
product_scope: PRIVATE_CAR_SATP
source_workbook: Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx
source_base_sheet: Pvtcar
rate_column: DELHI (column V)
policy_section: SATP
business_type_rule: same current and previous insurer -> Renewal
known_match_dimensions:
  business_type: Renewal
  fuel: CNG
  section: SATP
  ncb: All
  add_on: All
  location: DELHI
unknown_dimension:
  type: evaluate all source categories; do not infer Hatchback -> Compact
invariant_candidates:
  - Pvtcar!V511 = 38.0%
  - Pvtcar!V515 = 38.0%
  - Pvtcar!V519 = 38.0%
  - Pvtcar!V523 = 38.0%
  - Pvtcar!V527 = 38.0%
  - Pvtcar!V531 = 38.0%
  - Pvtcar!V535 = 38.0%
base_rate_percent: 38.0
base_rate_basis: Net Premium
od_applicability: not_applicable
incremental_coa: add if eligible when selected base rule is not all-inclusive; sample increment unresolved
override_precedence_high_level: Special Deal -> Specific Sub-segment -> Standard Grid
override_precedence_detailed_source: policy-specific -> fleet-code -> PAN-specific -> code-specific -> standard grid
higher_priority_override_status: no override record supplied; external applicability not disproven
anchor_date: policy issue date, or explicitly defined login date
```

## 8. Failure and ambiguity handling

| Situation | Required behavior |
|---|---|
| Current and previous insurer same | Apply challenge rule: Renewal. Preserve unusual coverage gaps as context. |
| RTO missing and policy is not Brand New | Do not use the Brand New branch-RTO fallback; ask for evidence or return unsupported. |
| Policy Type category is unknown but all candidate Type rows have identical rate and all other conditions match | Return the invariant base rate with all candidate rows in the decision trace. |
| Candidate Type rows produce different rates | Ambiguous until a valid vehicle-to-Type mapping is available. |
| Policy-specific/fleet/PAN/code-specific override data is supplied | Apply the stated precedence before Standard Grid. |
| Policy's intermediary code has no supplied override mapping | Use only the supplied standard-grid evidence and state that external override status is unverified. |
| GWP incremental COA needs a slab, but GWP or slab thresholds are unavailable | Base rate may be shown; total payout remains unresolved. Do not treat an old pivot zero as the increment. |
| Grid validity date does not cover the policy date | Unsupported/ambiguous; do not apply a nearby version automatically. |
| Stand-alone TP policy | OD = not applicable, not 0%. |

## 9A. Business clarifications supplied by the project owner (23-Nov-2026)

| Topic | Clarification | Implementation effect | Remaining evidence gap |
|---|---|---|---|
| Date selection | Select the active month using policy issuance date, or the insurer-defined login date if that is the specified anchor. | Date selection must precede grid lookup. | The supplied policy schedule does not clearly expose the login-date field; capture an authoritative issue/login anchor. |
| Override precedence | Special Deal → Specific Sub-segment → Standard Grid. | Check specific override sources before standard grid. | Map the high-level labels to the workbook's detailed policy/fleet/PAN/code levels when override files become available. |
| Detailed source priority | Workbook says policy-specific → fleet-code → PAN-specific → code-specific → standard grid. | Preserve this detailed priority in normalized rules. | `General Guidelines!C17` wording appears inconsistent with item d; do not silently rewrite it. |
| Incremental COA | Add eligible incremental COA only when the selected base rule is not all-inclusive. | Store `allInclusive` and incremental eligibility as explicit rule properties. | Exact GWP slab, current increment value, and sample's producer GWP evidence are not present/validated. |
| Net settlement | Apply relevant TDS/GST accounting adjustments and earlier clawbacks/endorsement reversals after gross payout. | Add a separate settlement-adjustment ledger. | Need signed amount/source and tax-treatment definitions; do not subtract taxes blindly. |

## 9. Test cases for the rating engine

1. **Golden base-grid sample:** Delhi + Renewal + CNG + SATP + NCB All + Add On All -> 38.0% base rate.
2. **Rate-invariance test:** all seven Type rows (511, 515, 519, 523, 527, 531, 535) produce the same Delhi value.
3. **No invented segment test:** Hatch Back is not silently mapped to Compact.
4. **Business classification test:** current insurer Tata AIG + previous insurer Tata AIG -> Renewal, even though the previous expiry is much earlier; retain the coverage gap as context.
5. **Premium basis test:** SATP rate basis is Net Premium, not OD premium or GST-inclusive total.
6. **Incremental COA test:** without GWP/slab evidence, do not add an assumed incremental percentage.
7. **Stale pivot test:** never use `pci checks` cached values for source rows outside `Pvtcar!G5:BO131`.
8. **Override precedence test:** policy-specific -> fleet -> PAN -> code -> standard; test missing override-source behavior explicitly.
9. **OD applicability test:** SATP returns OD `not_applicable`, not `0%`.

## 10. Open verification items

1. Obtain current, complete GWP slab definitions and the incremental COA matrix for Private Car SATP.
2. Confirm which GWP measure and time window determines the slab (producer-level, intermediary-level, insurer-level, or another basis); the supplied sheet does not sufficiently define this.
3. Obtain override data for policy-specific, fleet, PAN-specific, or code-specific cases, or an authoritative confirmation that none applies to intermediary code 721.
4. Confirm whether `General Guidelines!C17` intentionally omits the code-specific tier or is a wording error.
5. Confirm whether any unpublished mapping translates `Hatch Back` / Zen Estilo into one of the seven grid Type categories. It does not change this sample's base percentage because all candidate rows agree, but it may matter for future policies.
6. Confirm that the hidden `pci checks` pivot should be refreshed or replaced; it is not currently aligned with the full `Pvtcar` data range.

## 11. Gross payout vs net settlement – project-owner clarification

The project owner clarified the payout sequence:

1. Select the correct grid month using the policy issuance date, or the insurer-defined login date where applicable.
2. Lock the highest-priority matching rule: Special Deal → Specific Sub-segment → Standard Grid. Preserve and implement the workbook's more detailed policy-specific → fleet-code → PAN-specific → code-specific → standard hierarchy where those source categories are available.
3. If the selected rule is not all-inclusive, add an eligible incremental COA. If it is all-inclusive, do not add the incremental COA a second time.
4. Determine gross payout from the applicable base and incremental COA elements.
5. Separately derive net payable after applicable TDS/GST accounting adjustments and prior clawbacks / endorsement reversals.

### Required system separation

Do not collapse these into one commission-rate calculation:

- **Base commission rate:** percentage from selected base rule.
- **Incremental COA:** additional percentage/amount governed by GWP slab and all-inclusive flag.
- **Gross payout:** base payout plus eligible incremental COA.
- **Settlement adjustments:** signed accounting entries such as TDS, applicable GST treatment, clawbacks, or endorsement reversals.
- **Net payable:** gross payout after the applicable settlement adjustments.

The challenge primarily asks for commission percentages. TDS, GST, clawbacks, and endorsement reversals must therefore be stored as a separate settlement/reconciliation layer; they must not alter the reported base commission percentage. The precise sign and tax treatment of GST/TDS adjustments must come from an accounting rule/source rather than assuming every item is a deduction.

## 12. Rulebook conclusion

The sample's **base standard-grid TP rate candidate is 38.0% on Net Premium**, supported by `General Guidelines!C7`, `Pvtcar!F1:F3`, and all seven Delhi CNG/Renewal/SATP candidate rows `Pvtcar!V511`, `V515`, `V519`, `V523`, `V527`, `V531`, and `V535`. OD is **not applicable**.

The 38.0% base rate is invariant across all seven source Type categories, so the unknown Hatch Back → grid-Type mapping does not change this sample's base-rate candidate. However, the final all-in gross payout remains unresolved until the correct issue/login-date version is confirmed, any higher-priority override is ruled out or applied, and eligible incremental COA is determined. The `pci checks` cached pivot is stale/out of range and is not evidence that the sample's incremental COA is zero.
