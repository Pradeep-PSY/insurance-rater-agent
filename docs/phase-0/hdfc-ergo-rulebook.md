# HDFC ERGO – Private Car Comprehensive / Package Rulebook

**Research status:** The sample's Package-grid lookup is identified. The package-rate premium basis has been clarified by the project owner. Fuel evidence is external to the policy schedule, so retain its provenance.  
**Scope:** Supplied HDFC ERGO private-car comprehensive policy and the supplied February 2025 HDFC ERGO private-car grid PDF.

## 1. Source files

| Purpose | Source |
|---|---|
| Policy | `sample-policies/pvt-car-comprehensive-hdfc-ergo.pdf` |
| Commission grid | `raters/hdfc-ergo/feb-2025/Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf` |

The grid is a two-page PDF and states **Effective from 1st Feb'25**. This is earlier than the sample policy's issuance date of 26-Mar-2026, so the grid's stated effective date precedes the policy issue date.

## 2. Policy facts

Source: policy PDF, page 1 (scanned image; extracted through OCR/visual inspection).

| Fact | Value | Evidence / note |
|---|---|---|
| Insurer | HDFC ERGO General Insurance Company Limited | Policy page 1 |
| Policy type | Private Car Comprehensive Policy | Policy page 1 |
| Issue date | 26-Mar-2026 | Policy Details, page 1 |
| Period | 29-Mar-2026 to 28-Mar-2027 | Policy Details, page 1 |
| Previous insurer | Tata AIG General Insurance Company Limited | Previous Policy row, page 1 |
| Vehicle make/model | Mahindra Bolero Neo N10 (R) | Vehicle Details, page 1 |
| Registration / RTO | HR-26 / Gurgaon, Haryana | Vehicle Details, page 1 |
| CC | 1493 | Vehicle Details, page 1 |
| Manufacture year | 2023 | Vehicle Details, page 1 |
| Previous NCB | 25% | Previous Policy row, page 1 |
| Current NCB deduction | 35% | Premium Details, page 1 |
| Net Own Damage Premium (a) | ₹8,053 | Premium Details, page 1 |
| Net Liability Premium (b) | ₹3,816 | Premium Details, page 1 |
| Total Package Premium (a+b) | ₹11,869 | Premium Details, page 1 |
| GST / integrated tax | ₹2,136 | Premium Details, page 1 |
| Total premium including tax | ₹14,005 | Premium Details, page 1 |

The policy schedule's premium figures reconcile: ₹8,053 + ₹3,816 = ₹11,869 net package premium. GST is shown separately and is not part of the net premium base under the project-owner clarification below.

### Fuel provenance

Fuel is not explicitly printed in the inspected policy schedule. The 1493 CC Mahindra Bolero Neo N10 variant is externally corroborated as Diesel, but this must be retained as **external vehicle-reference evidence**, not represented as a fact printed on the policy. Runtime policy extraction should preserve:

- `policyEvidence.fuel = missing`
- `externalVehicleEvidence.fuel = diesel`
- `fuelResolution = externally_corroborated` (only if the application permits an approved vehicle-master source)

If the product's evidence policy requires policy-only extraction, fuel remains missing and the engine must not silently infer it.

### Business type

Current insurer is HDFC ERGO and previous insurer is Tata AIG. They differ. The challenge only gives an explicit same-insurer → Renewal rule. Do not infer New Business or Rollover from this difference alone; use explicit policy/source evidence if business type is required by a particular grid.

## 3. Grid structure and sample lookup

The PDF has separate **Package** and **SAOD** tables, with Zone 1 and Zone 2. Rate dimensions include fuel group, NCB / N-NCB and premium slab.

Relevant grid notes on page 1:

- Slab achievement is based on comprehensive + SAOD GWP for Private Car.
- SATP premium is excluded for slab achievement.
- Non-Petrol includes Diesel, CNG and LPG.
- New Business is considered as NCB.
- EV and Hybrid are considered in the Petrol grid.

Page 2 maps Haryana to **Zone 2**.

Sample lookup:

1. Policy is Private Car Comprehensive → use the **Package** table, not SAOD.
2. RTO/state is Gurgaon, Haryana → Zone 2 (grid page 2).
3. Net package premium is ₹11,869. The grid's package-slab note uses comprehensive + SAOD GWP, with SATP premium excluded. For this comprehensive policy, the supplied package amount is within the `>10k–50k` slab.
4. Current NCB deduction on the schedule is 35% → use the NCB column, not N-NCB.
5. Fuel is not printed on the policy. If external vehicle-master corroboration is permitted, classify this variant as Diesel → Non-Petrol.
6. Zone 2 + Package + `>10k–50k` + Non-Petrol + NCB gives a candidate grid rate of **17.50%** (PDF page 1).

## 4. Package-rate basis – project-owner clarification

**Clarification supplied by the project owner in chat (23-Nov-2026):**

A Package Rate is a single rate applied to the policy's entire Net Premium, which is the sum of OD and TP/liability net premium, excluding GST. It is not an OD-only rate. Under this interpretation, no separate TP percentage is paid on top of the Package Rate.

Illustration from the project owner:

- Net Premium = ₹10,000 (OD ₹4,000 + TP ₹6,000), GST separate.
- Package Rate 12% → ₹10,000 × 12% = ₹1,200.
- No additional TP commission is calculated separately.
- By contrast, when the grid publishes separate OD and TP rates, calculate each against its own component.

### Runtime consequence

For the HDFC sample, subject to accepted fuel evidence:

- `rate_scope = package`
- `rate_percent = 17.50`
- `premium_basis = total_net_package_premium`
- `premium_basis_amount = ₹11,869`
- `gst_included = false`
- `od_and_tp_separately_rated = false`

Do **not** represent the single Package Rate as an OD-only rate or invent a separate TP rate. The result contract should support a package-level rate with component-level rates marked `not_separately_specified` (not `not_applicable`, because both cover components exist).

Optional base-only arithmetic: ₹11,869 × 17.50% = ₹2,077.075, approximately ₹2,077.08. The challenge primarily requires the percentage; the amount is supplementary and should follow the agreed currency-rounding rule.

## 5. Important distinction: slab basis vs payout basis

Keep these two concepts separate:

1. **Grid slab selection:** the PDF says comprehensive + SAOD GWP is used for slab achievement, and SATP premium is excluded.
2. **Package commission payout basis:** project-owner clarification says the selected Package Rate applies to the total policy Net Premium (OD + TP/liability), excluding GST.

Do not assume that the value used to select a slab is always identical to the amount on which the commission percentage is applied.

## 6. Conditions, exceptions and failure handling

| Situation | Handling |
|---|---|
| Haryana RTO/state | Map to Zone 2 using page 2. |
| Comprehensive policy | Select Package table. |
| Policy falls in `>10k–50k` slab | Select the matching package slab. |
| NCB present | Use NCB column; do not use N-NCB. |
| Fuel absent from policy | Use only an approved, cited external vehicle master; otherwise ask/mark ambiguous if fuel is required. |
| Fuel category cannot be reliably determined | Do not choose Petrol/Non-Petrol by guess. |
| Grid has a Package rate only | Return package-level rate scope; do not fabricate separate OD and TP percentages. |
| Grid date is later than policy issue/login date | Do not apply it unless a source explicitly allows retrospective use. |

## 7. Runtime rule specification

```text
insurer: HDFC_ERGO
product_scope: PRIVATE_CAR_COMPREHENSIVE
source: HDFC ERGO grid PDF, effective 2025-02-01
anchor_date: policy_issue_date (or an explicitly defined login date if insurer rule requires it)
location: Haryana -> Zone 2
rate_table: Package
slab_dimension: comprehensive + SAOD GWP; exclude SATP premium
fuel_group: Diesel/CNG/LPG -> Non-Petrol; Petrol/EV/Hybrid -> Petrol (per grid note)
ncb_dimension: current policy NCB classification
sample_slab: >10k-50k
sample_rate: 17.50%
rate_scope: package
payout_basis: total net package premium (OD + TP/liability), GST excluded
component_rates: not separately specified for OD and TP
```

## 8. Evidence and confidence

- Policy facts: policy PDF page 1.
- Zone: grid PDF page 2.
- Rate and slab: grid PDF page 1.
- Package payout basis: project-owner clarification, not a statement found in the PDF itself.
- Fuel: external vehicle reference, not policy evidence.

The percentage lookup is reproducible from the grid once the approved fuel source is fixed. The decision trace must explicitly identify the source class of each fact and the package-level scope of the rate.
