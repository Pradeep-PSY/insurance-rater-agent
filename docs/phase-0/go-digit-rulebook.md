# Go Digit - Private Car Stand-alone TP Rulebook

**Research status:** Lookup path verified. The raw `Max CD2` value is preserved, but the project owner has asked us to skip its semantic interpretation because no definition is available. Therefore no TP commission percentage is approved for output. The exact effective date also remains unconfirmed.  
**Scope:** The supplied Go Digit sample policy is a private-car stand-alone Third-Party (SATP) policy. This rulebook does not cover Go Digit's other vehicle/product tabs.

## 1. Source files

| Purpose | Source |
|---|---|
| Policy | `sample-policies/pvt-car-satp-go-digit.pdf` |
| Commission grid | `raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx` |
| RTO mapping sheet | `4W  RTO` (two spaces between `4W` and `RTO`) |
| SATP rate sheet | `4W SATP` |

The grid workbook contains 14 worksheets. For this sample, the relevant sheets are `4W  RTO` and `4W SATP`. The workbook filename/folder label identifies it as the March 2026 grid, but the `4W SATP` sheet does not state an explicit effective-from date. Do not treat the folder label alone as a formally verified effective date.

## 2. Policy facts extracted from the supplied PDF

Source: `pvt-car-satp-go-digit.pdf`.

| Fact | Extracted value | Source |
|---|---|---|
| Insurer | Go Digit General Insurance Ltd. | Page 1 |
| Policy wording/type | Digit Private Car Liability Only Policy | Page 1 |
| Policy issue date | 24-Mar-2026 | Page 1 |
| Current TP cover period | 25-Mar-2026 to 24-Mar-2027 | Page 1 |
| Vehicle registration number | `UP78FZ1372` (de-identified suffix as shown in fixture) | Page 1 |
| RTO location | Kanpur Nagar, Uttar Pradesh | Page 1 |
| Make | Hyundai | Page 1 |
| Model/variant | Santro New / 1.1 MT Corporate | Page 1 |
| Fuel | Petrol | Page 1 |
| Cubic capacity | 1086 CC | Page 1 |
| Registration year | 2019 | Page 1 |
| Manufacture-year field | Rendered as `0001-01-01`; invalid/unusable as a manufacture year | Page 1 |
| Previous insurer | Go Digit General Insurance Limited | Page 2 |
| Previous policy expiry | 24-Mar-2026 | Page 2 |
| Basic Third-Party premium | ₹3,416 | Page 2 |
| Legal Liability to Paid Driver | ₹50 | Page 2 |
| Add-on premium | ₹0 | Page 2 |
| Net premium | ₹3,466 | Page 2 |
| GST | ₹623.88 | Page 2 |
| Final premium | ₹4,089.88 | Page 2 |

The stated net premium reconciles to the visible TP components: ₹3,416 + ₹50 = ₹3,466. The GST-inclusive final premium is not the lookup input for a rate expressed as a percentage of premium.

### Business type

The current insurer and previous insurer are both Go Digit. Under the challenge's explicit classification rule, classify the business type as **Renewal**. The supplied `4W SATP` lookup table does not contain a business-type dimension, so this classification does not change this particular row selection.

### OD/TP applicability

This is a liability-only / stand-alone TP policy:

- OD: **Not applicable** (not 0%).
- TP: Applicable.

## 3. Grid structure and lookup dimensions

### 3.1 RTO mapping

In `4W  RTO`:

| Cell | Header/value |
|---|---|
| `B2` | `RTO Code` |
| `C2` | `4WTP` |
| `D2` | `4W Package` |
| `E2` | `4WSAOD` |
| `F2` | `PLR Cluster` |
| `B1609` | `UP78` |
| `C1609` | `UP_Bad` |
| `D1609` | `UP` |
| `E1609` | `UP` |
| `F1609` | `UP_GOOD2` |

For a private-car SATP policy, select the `4WTP` mapping column, not the Package, SAOD, or PLR columns. Therefore:

`UP78 -> 4WTP cluster UP_Bad`

The RTO code is supported by the registration prefix `UP78` on policy page 1. The location text also says Kanpur Nagar, Uttar Pradesh.

### 3.2 SATP rate table

In `4W SATP`:

| Cell | Meaning |
|---|---|
| `B2` | Cluster |
| `C2` | Segment |
| `D2` | Age |
| `E2` | Max CD2 |
| `F2` | Note |

The policy's vehicle segment is derived from the grid's own category labels:

- Fuel = Petrol
- CC = 1086
- 1086 CC is greater than 1000 CC
- Grid segment = `Petrol>1000`

The matching row is:

| Cell | Value |
|---|---|
| `B293` | `UP_Bad` |
| `C293` | `Petrol>1000` |
| `D293` | `All` |
| `E293` | `0.29499999999999998` |
| `F293` | blank |

`E293` is formatted as `0.0%`, so its displayed value is **29.5%**.

### 3.3 Sample-policy lookup path

1. Detect the policy as Go Digit private-car liability-only / SATP.
2. Extract RTO prefix `UP78`.
3. Look up `UP78` in `4W  RTO`, using the `4WTP` column (`C`): `UP78 -> UP_Bad` (`B1609:C1609`).
4. Read fuel `Petrol` and CC `1086` from policy page 1.
5. Apply the SATP grid's segment label: `Petrol>1000`.
6. The row's age condition is `All`; no vehicle-age calculation is required for this match.
7. Find the unique row `UP_Bad + Petrol>1000 + All` in `4W SATP` (`B293:E293`).
8. Check the row's Note cell (`F293`); it is blank.
9. Preserve the raw grid field as `Max CD2 = 0.295` (displayed as 29.5%); do not interpret it as broker commission.

The bad manufacture-year value does not block this particular lookup because the matched row explicitly uses `Age = All`.

## 4. Rate interpretation – intentionally not resolved

The exact workbook heading is **`Max CD2`**. The source workbook does not expand the acronym `CD2`, and the `4W SATP` sheet does not name the column `TP brokerage` or `TP commission`.

The sample's matching row contains:

- `4W SATP!E293` raw numeric value: `0.29499999999999998`.
- Cell number format: `0.0%`.
- Displayed value: `29.5%`.
- Raw field name: `Max CD2`.

**Project-owner decision supplied in chat (23-Nov-2026):** The meaning was not found and we should skip this field's semantic interpretation rather than treating it as a confirmed broker commission rate.

### Runtime consequence

- Preserve the source field name `Max CD2`.
- Preserve the raw value and displayed percentage for audit/research only.
- Do not rename it to `TP Commission`, `Brokerage`, or `Broker Payout`.
- Do not emit 29.5% as the final TP brokerage rate.
- Because the source contains a percentage-like outcome but does not establish what it represents, the sample's commission-rate decision should be `ambiguous` (or withheld from rate output) until an authoritative definition is supplied.
- OD remains `not_applicable` because the policy is SATP.

This is a deliberate evidence-backed non-answer, not a failure to perform the lookup.

## 5. General dimensions and exceptions in `4W SATP`

The worksheet's condition model is:

`Cluster + Segment + Age -> Max CD2 + Note`

Observed segment labels are not globally uniform. They include labels such as:

- `CNG<1000`, `CNG>1000`, `CNG 1000-1500`, `CNG >1500`, and generic `CNG`;
- `Diesel<1500`, `Diesel>1500`, and generic `Diesel`;
- `Petrol<1000`, `Petrol>1000`, `Petrol 1000-1500`, and `Petrol>1500`.

Use the exact segment labels and conditions for the selected cluster. Do not assume one universal segmentation scheme across all clusters.

The Age values observed in the table are `<10`, `>10`, and `All`. There is no explicit `=10` category. An exact 10-year age boundary must not be forced into either adjacent category without a source rule.

### Notes/exceptions recorded in the source

| Row | Cluster | Segment | Age | Note text | Handling |
|---:|---|---|---|---|---|
| 27 | AP TS_Good1 | Petrol<1000 | >10 | More than 1500CC and 10+age is declined | Note appears inconsistent with this row's segment; do not infer scope. |
| 67 | Delhi/NCR | Diesel<1500 | All | Few RTOs for 10+ age are declined | Specific RTOs are not identified in this row. |
| 68 | Delhi | Diesel>1500 | All | Few RTOs for all age are declined | Specific RTOs are not identified in this row. |
| 69 | NCR | Diesel>1500 | All | Few RTOs for all age are declined | Specific RTOs are not identified in this row. |
| 70 | Delhi/NCR | Petrol<1000 | All | Few RTOs for <10 age are declined | Specific RTOs are not identified in this row. |
| 120 | HR_Bad | Petrol>1000 | All | 1000-1500CC and <10 age is declined | Note describes a subset not represented directly by the row's broad condition. |
| 163 | Kerala | Petrol>1000 | All | 1000-1500CC and <10 age is declined | Note describes a subset not represented directly by the row's broad condition. |
| 180 | Mumbai | CNG>1000 | All | Few RTOs for 1000-1500CC segment are declined | Specific RTOs are not identified in this row. |
| 244 | RJ_Good | Petrol>1000 | All | Few RTOs for more than 1500CC and 10+age are declined | Specific RTOs are not identified in this row. |
| 324 | Mumbai 2 | CNG | All | Few RTOs for 1000-1500CC segment are declined | Specific RTOs are not identified in this row. |

The row-level notes above are not fully machine-actionable because some say “few RTOs” without listing those RTOs, and some describe a narrower condition than the row itself. Do not convert those notes into broad blanket exclusions. They require an explicit RTO/condition list from the insurer or a separately supplied exception source.

The workbook also has a cluster named `All_India_Decline` with zero-valued entries for the listed SATP segments. Treat this as a decline indicator requiring the challenge's refusal handling; do not silently interpret a decline as an ordinary payable `0%` commission without an explicit business definition.

## 6. Runtime rule specification

```text
product_scope: PRIVATE_CAR_SATP
source_sheet: 4W SATP
rto_mapping_sheet: 4W  RTO
rto_mapping_column: 4WTP
match_dimensions:
  - cluster
  - segment
  - age
segment_derivation:
  - use fuel category from policy
  - use engine capacity and the selected cluster's exact segment labels
age_handling:
  - if matched row says All, age is not required
  - otherwise calculate age using the policy/grid-defined reference date
  - do not auto-classify exactly 10 years where grid has only <10 and >10
result_field_raw: Max CD2
source_rate_cell_for_sample: 4W SATP!E293
raw_value: 0.29499999999999998
displayed_value: 29.5%
semantic_mapping: intentionally skipped / unconfirmed
final_tp_commission_rate: not approved
sample_decision: ambiguous pending authoritative Max CD2 definition
od_applicability: not_applicable
```

## 7. Failure and ambiguity handling

| Situation | Required behavior |
|---|---|
| RTO code absent from policy | Do not guess a cluster; request clarification or return unsupported. |
| RTO code not found in the correct 4WTP mapping column | Unsupported. |
| Multiple conflicting RTO mappings | Ambiguous. |
| Fuel or CC missing when needed to choose a segment | Ambiguous or clarification request. |
| Exact CC boundary not covered by a segment label | Do not choose the nearest band; mark unsupported/ambiguous. |
| Row note gives an unlisted “few RTOs” exclusion and policy may be affected | Do not assume the RTO is eligible; hold for exception verification. |
| Cluster is `All_India_Decline` | Mark declined/unsupported under challenge output contract; do not report an ordinary 0% rate. |
| Matched `Max CD2` is exactly zero | Preserve the explicit source value, but distinguish zero payout from decline only when source semantics establish it. |
| Age is required and is exactly 10 years | Ambiguous/unsupported until boundary semantics are clarified. |

## 8. Test cases for the rating engine

1. **Lookup-path fixture:** `UP78 + Petrol + 1086 CC` -> `UP_Bad + Petrol>1000 + All` -> raw `Max CD2 = 0.295`; assert that no approved TP commission percentage is emitted.
2. **Correct mapping-column test:** SATP must use `4WTP` (`C`), not `4W Package`, `4WSAOD`, or `PLR Cluster`.
3. **Age-irrelevant test:** if a selected row says `All`, missing/invalid manufacture year must not block that row.
4. **Segment boundary tests:** exact 1000 CC and exact 1500 CC must not be placed in a band unless that cluster's source labels define the boundary.
5. **Age boundary test:** exact 10 years is not silently assigned to `<10` or `>10`.
6. **Exception-note tests:** “few RTOs declined” is not a blanket cluster decline; require a specific affected-RTO source.
7. **Decline test:** `All_India_Decline` does not become a normal 0% commission result.
8. **OD applicability test:** SATP returns OD `not_applicable`, not `0%`.

## 9. Open verification items

1. No implementation action on `Max CD2` until an authoritative definition is supplied. Keep the raw value for audit only; do not label it as brokerage.
2. Confirm the effective-from/effective-to dates for the March 2026 Go Digit grid; the SATP worksheet itself does not show one.
3. Obtain the exact RTO lists behind notes such as “Few RTOs ... are declined.”
4. Confirm the interpretation of zero-valued entries and the `All_India_Decline` cluster.
5. Resolve the apparent mismatch between some note text and the row's own segment/age conditions.

## 10. Rulebook conclusion

The sample's **lookup path** is reproducible from source cells:

`Policy UP78 -> 4WTP cluster UP_Bad -> Petrol>1000 -> Age All -> 4W SATP!E293 = 0.295 (raw field Max CD2)`.

However, the source does not define `Max CD2`, and the project owner has directed us to skip its semantic interpretation. Therefore **29.5% is not approved as the TP commission rate**. The rate decision remains ambiguous / withheld until an authoritative definition is available. OD is **not applicable**. Preserve the raw cell evidence for audit, but do not expose it as an approved commission percentage.
