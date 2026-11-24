# Reliance IndusInd – Private Car Comprehensive Rulebook

**Research status:** Mapping and conditional rate path identified. The supplied grid is temporally later than the sample policy and must not be applied to the December 2025 policy. The `<1000 CC` adjustment operation has been clarified by the project owner for future valid grid/policy combinations.

## 1. Source files

| Purpose | Source |
|---|---|
| Policy | `sample-policies/pvt-car-comprehensive-reliance.pdf` |
| Commission grid | `raters/reliance-indusind/feb-2026/Reliance Broking Premier FEB 26 Grid.xlsx` |
| Private-car base rates | `PRIVATE CAR COMP, SAOD & STP` |
| RTO mapping | `RTO List` |
| Make/model mapping | `Make Model wise segment` |
| Additional terms | `Enabler, PO Guidelines & T&C` |

The workbook's `PRIVATE CAR COMP, SAOD & STP` sheet is titled **Pvt Car Old Business Grid - Jan-26**. The workbook/file is labelled February 2026. Both are later than the sample policy's December 2025 issue date.

## 2. Policy facts

Source: supplied Reliance policy PDF, page 2 for schedule/premium facts.

| Fact | Value | Evidence / note |
|---|---|---|
| Insurer | Reliance General Insurance | Policy page 2 |
| Proposal/business type | “Renewal of Policy” option is ticked | Proposal form, page 9 |
| Policy issue / invoice date | 12-Dec-2025 06:00 | Policy page 2 |
| Period of insurance | 23-Dec-2025 to 22-Dec-2026 | Policy page 2 |
| Vehicle | Renault Kwid 1.0 RXT O | Policy page 2 |
| RTO / location | UP-16, Noida, Uttar Pradesh | Policy page 2 |
| CC | 999 | Policy page 2 |
| Manufacture month/year | Oct-2020 | Policy page 2 |
| Previous insurer | Not identified in the inspected policy pages | Do not infer it from the current insurer name |
| NCB deduction | 25% | Policy page 2 |
| Total Basic OD Premium before NCB | ₹5,064.16 | Policy page 2 |
| NCB deduction | -₹350.01 | Policy page 2 |
| Total Own Damage Premium | ₹4,714.00 | Policy page 2 |
| Total Basic Liability Premium | ₹2,094.00 | Policy page 2 |
| PA benefits | ₹375.00 | Policy page 2 |
| Legal liability to paid driver | ₹50.00 | Policy page 2 |
| Total Liability Premium | ₹2,519.00 | Policy page 2 |
| Total Package Premium | ₹7,233.00 | Policy page 2 |
| IGST | ₹1,302.00 | Policy page 2 |
| Total payable | ₹8,535.00 | Policy page 2 |

The proposal form (page 9) explicitly marks “Renewal of Policy”. It also marks “Are you an existing Reliance General Insurance Customer?” as No. These are distinct fields: preserve the proposal-type value as Renewal, and do not infer the previous insurer from the current insurer or the customer-status checkbox. The previous insurer is not identified in the inspected pages.

Fuel is not explicitly printed in the inspected policy schedule. Renault Kwid 1.0 / 999 CC is externally corroborated as Petrol, but an external vehicle reference must not be misrepresented as policy evidence. Use it only if the application has an approved vehicle-master source; otherwise fuel remains unverified.

## 3. Mapping path from the supplied workbook

### 3.1 RTO mapping

`RTO List!A1253:E1253`:

- Registration prefix: `UP16`
- Region City: `Delhi`
- Market Type: `T20`
- Zone: `NORTH`

### 3.2 Make/model mapping

`Make Model wise segment!A397:C397`:

- Make: `RENAULT`
- Model: `KWID`
- Vehicle Segment: `SMALL`

The visible private-car rate table does not have a `SMALL` column. Preserve this mapping as supporting metadata; do not invent an adjustment based on it unless a rule explicitly refers to the segment.

## 4. Private-car base grid

Relevant sheet: `PRIVATE CAR COMP, SAOD & STP`.

- `A11:F11` is the NORTH / Delhi row.
- `C11` = 22.5 for Petrol/Bifuel/Comp.
- `D11` = 10 for Diesel/EV/Comp.
- `E11` = 20 for SA OD.
- `F11` = 0 for STP.
- `H2` says payout will be made on OD Premium.
- `H3` says for `<1000 CC`, PO will be 5% lesser than the above grid.

For a 999 CC Petrol comprehensive policy, the candidate base rate from the table is 22.5%, with the `<1000 CC` adjustment triggered. However, this supplied grid is not temporally applicable to the sample policy (see Section 5), so this candidate must not be returned as the sample's final answer.

## 5. Grid effective-date rule and sample outcome

**Project-owner clarification supplied in chat (23-Nov-2026):** A February 2026 payout/commission grid should generally not be applied to a policy issued in December 2025. The policy's relevant grid should be the grid valid for the policy's issue period, unless an insurer instruction explicitly specifies another anchor or retrospective applicability.

For this sample:

- Policy issue date: 12-Dec-2025.
- Supplied Reliance workbook: labelled February 2026; private-car tab titled January 2026 old-business grid.
- The supplied source set does not contain a contemporaneous December 2025 grid or an instruction permitting retrospective application.

**Decision:** The supplied February 2026 / January 2026 grid must not be applied to this December 2025 policy. The sample's Reliance rate is **unsupported from the supplied corpus** due to missing temporally applicable rate-card evidence. Do not return 22.5% or 21.375% as the policy's final rate.

Runtime date-selection rule:

1. Use the policy issue date as the default effective-date anchor.
2. If the insurer's supplied instructions explicitly define login/proposal date as the anchor, use that date instead and record why.
3. Select a grid whose effective period covers the anchor date.
4. If no supplied grid covers the anchor date, return unsupported; do not substitute the newest available grid.
5. Apply retrospective rules only when an authoritative source explicitly states them.

## 6. `<1000 CC` adjustment – project-owner clarification

**Clarification supplied by the project owner in chat (23-Nov-2026):** Interpret “5% lesser” as a relative reduction of the base rate, not subtraction of five percentage points.

Formula:

```text
adjusted_rate = base_rate × (1 - 0.05)
              = base_rate × 0.95
```

Example from the project owner:

- Base rate = 20%.
- Adjusted rate = 20% × 0.95 = 19%.

For a future temporally valid use of the supplied illustrative base 22.5%:

- Adjusted rate = 22.5% × 0.95 = **21.375%**.

This is a conditional rule example, not the rate for the supplied December 2025 policy.

### Runtime representation

Do not store “5% lesser” as an ambiguous free-text formula. Represent it as an explicit relative multiplier:

```json
{
  "adjustmentType": "relative_rate_reduction",
  "factor": "0.95",
  "condition": { "engineCapacityCC": { "lt": 1000 } },
  "source": {
    "sheet": "PRIVATE CAR COMP, SAOD & STP",
    "cell": "H3"
  },
  "interpretationSource": "project_owner_clarification"
}
```

Use decimal arithmetic. Do not convert this into `subtract 5 percentage points`.

## 7. Premium basis

The Reliance base grid's `H2` states payout is made on **OD Premium**. Therefore, when the correct effective grid is available and the relevant product rule is selected, use the OD premium component as the payout basis, not the total package premium.

For this policy, the schedule shows Total Own Damage Premium ₹4,714.00. However, because the supplied grid is not temporally applicable, do not calculate or publish a commission amount from it.

## 8. Additional conditions visible in the supplied workbook

| Cell | Condition | Handling |
|---|---|---|
| `H2` | Payout on OD Premium | Use OD premium as basis for applicable comprehensive grid rate. |
| `H3` | `<1000 CC` PO 5% lesser | Apply 0.95 multiplier per project-owner clarification, when the grid version is valid. |
| `H4` | Standalone ZD policies: reduce 2.5% | Preserve as a separate condition; do not apply without ZD policy evidence. Meaning of reduction should be encoded only after its exact operation is established. |
| `H5` | Extended Warranty: flat 20% payout | Only apply when the product/add-on is present and source conditions are met. |
| `H6` | Tyre/RTI bundle, if sourced: 2.5% additional payout | Requires add-on and sourcing evidence; do not apply by default. |

## 9. Runtime rule specification

```text
insurer: RELIANCE_INDUSIND
product_scope: PRIVATE_CAR_COMPREHENSIVE
anchor_date: policy_issue_date unless source explicitly specifies login/proposal date
sample_policy_issue_date: 2025-12-12
supplied_grid_label: FEB'26 workbook / JAN-26 private-car old-business sheet
sample_grid_applicability: NOT_APPLICABLE_FROM_AVAILABLE_EVIDENCE
sample_result: unsupported

mapping:
  rto: UP16 -> Delhi / T20 / NORTH
  make_model: RENAULT / KWID -> SMALL
  note: SMALL is not a visible column in the base-rate table

base_grid_candidate_if_temporally_valid:
  zone_region: NORTH / Delhi
  fuel_product: Petrol/Bifuel/Comp
  base_rate: 22.5%
  payout_basis: OD Premium
  cc_adjustment:
    condition: engineCapacityCC < 1000
    operation: multiply_rate_by
    factor: 0.95
    adjusted_candidate: 21.375%
```

## 10. Failure and ambiguity handling

| Situation | Required behavior |
|---|---|
| No grid covers policy issue/login date | Unsupported; do not use newest grid as substitute. |
| Policy date anchor is unclear | Ask for/resolve the authoritative issue or login date. |
| Fuel is missing from policy | Use an approved external vehicle master with separate evidence, or mark unresolved. |
| RTO mapping missing/conflicting | Unsupported/ambiguous respectively. |
| CC <1000 and a valid grid applies | Multiply base rate by 0.95. |
| ZD / EW / Tyre / RTI condition not evidenced | Do not apply its adjustment. |
| Make/model segment exists but is not used by the visible rate matrix | Preserve mapping; do not fabricate a segment rate. |
