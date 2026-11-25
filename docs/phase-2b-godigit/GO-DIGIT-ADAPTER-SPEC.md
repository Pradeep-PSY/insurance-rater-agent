# Phase 2B – Go Digit Private Car SATP Adapter Specification

**Status:** Implementation scope for the first insurer adapter  
**Depends on:** Phase 2A raw source readers and real-corpus inventory  
**Explicitly deferred:** Remaining Phase 1 P0 contract defects  
**Adapter scope:** Go Digit private-car Stand-alone Third Party (SATP) only

## 1. Objective

Implement an insurer-specific adapter that consumes the Phase 2A `GridDocumentIR` for the supplied Go Digit workbook and emits a typed, source-cited **Go Digit adapter draft** for the private-car SATP lookup path.

The adapter must not read XLSX files directly, recalculate formulas, infer undefined meanings, or emit an approved commission percentage from `Max CD2`.

This is a grid-normalization task, not the runtime rating engine and not the final canonical `RuleBundle` publication task.

## 2. Source of truth

Original workbook:

`data/source-corpus/raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx`

Relevant workbook sheets (preserve exact sheet names, including the two spaces in `4W  RTO`):

- `4W  RTO`
- `4W SATP`

Relevant source structures:

### 2.1 `4W  RTO`

Header row: `B2:F2`

- `B2`: `RTO Code`
- `C2`: `4WTP`
- `D2`: `4W Package`
- `E2`: `4WSAOD`
- `F2`: `PLR Cluster`

For this adapter's SATP product path, use **only the `4WTP` column (`C`)** as the product-specific cluster mapping. Do not substitute `4W Package`, `4WSAOD`, or `PLR Cluster`.

Supplied sample mapping:

- `B1609:C1609`: `UP78` → `UP_Bad`

The workbook has 80 RTO rows mapped to the `All_India_Decline` cluster in the `4WTP` column. These must be represented as decline candidates, not as an ordinary 0% rate.

The Phase 2A real-corpus inventory reported 14 visible worksheets in this workbook. It also reported 315 cached `#N/A` cells in the separate `CV RTO Mapping` sheet. That is outside this private-car SATP lookup path: preserve the source-level errors in the raw inventory, but do not treat those CV errors as SATP mapping failures or silently repair them.

Preserve all source RTO codes, normalized RTO codes, product-cluster values, row/cell references, and duplicates/conflicts. Do not silently deduplicate conflicting mappings.

### 2.2 `4W SATP`

Header row: `B2:F2`

- `B`: `Cluster`
- `C`: `Segment`
- `D`: `Age`
- `E`: `Max CD2`
- `F`: `Note`

The row-selection dimensions are:

`Cluster + Segment + Age`

Supplied sample candidate row:

- `B293`: `UP_Bad`
- `C293`: `Petrol>1000`
- `D293`: `All`
- `E293`: raw numeric value `0.29499999999999998`
- `E293` number format: `0.0%` (displayed as 29.5%)
- `F293`: blank

The workbook has 119 formula-generated composite keys in column A. Preserve formula text and cached results in the raw IR, but treat explicit columns B:F as the authoritative dimensions and source fields. Do not recalculate formulas or make column A the sole lookup authority.

## 3. Critical business constraints

1. The workbook heading is exactly `Max CD2`.
2. The project owner has not found an authoritative definition for `Max CD2` and explicitly instructed us to skip its semantic interpretation.
3. Preserve the field name, raw value, number format, and source cell. A display string such as `29.5%` may be retained as formatting metadata, but must not be promoted to a commission rate.
4. `Max CD2` must have semantic status `UNRESOLVED` (or an equally explicit adapter-draft status) and `eligibleForCommissionOutput: false`.
5. Do not emit `29.5%` as TP brokerage, commission, or broker payout.
6. For the supplied SATP sample, the commission-rate decision remains unresolved/ambiguous pending an authoritative `Max CD2` definition. This is not a parser failure.
7. OD applicability for SATP is `NOT_APPLICABLE`, never `0%`.
8. The sample policy's current insurer and previous insurer are both Go Digit, so business type is Renewal under the challenge rule. However, the `4W SATP` table has no business-type dimension. Preserve this fact but do not inject it into row matching.
9. The manufacture-year field in the sample policy is invalid (`0001-01-01`). The matching sample row has Age=`All`, so no vehicle-age calculation is needed for that lookup.
10. Do not infer effective-from/effective-to dates solely from the workbook filename or folder label. The March 2026 label is source-period metadata, not independently verified effective-date bounds.

## 4. Segment handling

Segment labels are cluster/table-specific and are not globally uniform. Examples observed include:

- `CNG<1000`, `CNG>1000`, `CNG 1000-1500`, `CNG >1500`, generic `CNG`
- `Diesel<1500`, `Diesel>1500`, generic `Diesel`
- `Petrol<1000`, `Petrol>1000`, `Petrol 1000-1500`, `Petrol>1500`

Requirements:

- Preserve exact segment labels as found in the grid.
- Do not invent one global fuel/CC segmentation formula.
- For this sample, record the supported interpretation `Petrol + 1086 CC → Petrol>1000`, with provenance to the policy evidence and exact grid label.
- If multiple segment labels overlap or the correct segment cannot be uniquely determined from documented rules, emit an unresolved segment-resolution warning rather than guessing.

## 5. Age handling

Observed grid categories include `<10`, `>10`, and `All`.

- `All` means age is not required for that row match.
- Do not derive age using today's date.
- Use only an insurer/grid-defined age reference date if one is explicitly supported.
- There is no explicit `=10` category. An exact 10-year boundary must remain unresolved unless an authoritative rule defines the treatment.
- Preserve the original age condition string and source cell.

## 6. Declines and notes

### 6.1 `All_India_Decline`

Treat the `All_India_Decline` cluster as an explicit decline candidate for the SATP product path. Preserve the mapping cells and cluster row evidence. Do not represent the corresponding zero-valued table entries as a normal 0% commission.

### 6.2 Row notes

Preserve all non-empty notes from column F as first-class source-cited note/exception candidates, including at least these known rows:

`27, 67, 68, 69, 70, 120, 163, 180, 244, 324`

Some notes say “few RTOs” without naming those RTOs, and some notes describe narrower conditions than the row's broad dimensions. Some wording may be inconsistent with the row segment.

Requirements:

- Preserve exact note text and row/cell citation.
- Mark notes with incomplete/ambiguous scope as `UNRESOLVED_EXCEPTION`.
- Do not convert “few RTOs” into an exclusion for all RTOs.
- Do not broaden a narrow CC/age note to the whole row.
- Do not silently discard inconsistent notes.

## 7. Required output: adapter-specific draft

Because the remaining Phase 1 P0 contracts are explicitly deferred, do **not** modify `phase-1/` or force incomplete data into its current `CommissionRule` schema.

Create an adapter-specific typed output, for example:

`GoDigitSatpAdapterDraft`

It should contain at least:

- `adapterVersion`
- `sourceIdentity` (source ID, original file name/path, SHA-256, byte size, source-period label, effective-date status)
- `productScope: PRIVATE_CAR_SATP`
- `rtoMappings[]` (raw RTO, normalized RTO, 4WTP cluster, source locator)
- `satpRows[]` (cluster, exact segment label, age condition, raw Max CD2, number format, note, source locator)
- `declineCandidates[]`
- `exceptionCandidates[]`
- `sampleResolutionTrace` (policy inputs, 4WTP mapping, segment selection, age selection, candidate row, raw metric status, OD applicability)
- `warnings[]`
- `validationSummary`

Use typed discriminated unions and Zod validation. Avoid `any` and unstructured generic JSON where practical.

The adapter draft may include an explicit raw metric observation with fields such as:

- `fieldName: "Max CD2"`
- `rawNumericValue: "0.29499999999999998"` (preserve exact source representation where the raw IR supports it)
- `numberFormat: "0.0%"`
- `semanticStatus: "UNRESOLVED"`
- `eligibleForCommissionOutput: false`
- `source: { sheet: "4W SATP", cell: "E293" }`

Do not create a canonical approved commission-rate object from this metric.

## 8. Required validation and tests

At minimum, add automated tests for:

1. Correct source workbook/sheet identification.
2. Exact `4W  RTO` sheet name (two spaces).
3. SATP uses the `4WTP` mapping column (`C`), not Package/SAOD/PLR.
4. `UP78` maps to `UP_Bad` with exact cell citation `B1609:C1609`.
5. Sample `UP_Bad + Petrol>1000 + All` resolves to exactly one candidate row `B293:F293`.
6. `Max CD2` raw value and number format are preserved, but no approved commission rate is emitted.
7. `All_India_Decline` mappings are decline candidates, not 0% commission.
8. All 80 decline mappings are counted from the real workbook; do not hardcode the count as a rule.
9. Segment labels are preserved exactly and no universal segmentation assumption is applied.
10. `Age=All` does not require manufacture year or age.
11. Exact age 10 does not silently match `<10` or `>10`.
12. Non-empty notes are preserved with exact cells.
13. “Few RTOs” notes are unresolved rather than broad exclusions.
14. Conflicting/duplicate RTO mappings are surfaced.
15. Missing RTO, missing segment, zero candidate rows, and multiple candidate rows produce explicit unresolved outcomes.
16. Formula text and cached value in SATP column A remain separate; no formula recalculation occurs.
17. No OD rate is emitted for the SATP product.
18. No commission rules are falsely marked approved.

Use real-corpus adapter tests against the Phase 2A inventory/IR. Keep small synthetic tests for edge cases.

## 9. Architecture boundaries

- The adapter consumes Phase 2A `GridDocumentIR` (or a clearly defined serialized equivalent).
- Do not import ExcelJS or PDF.js into the insurer adapter.
- Do not parse the original workbook again inside the adapter.
- Do not edit Phase 0 source documents or `MANIFEST.json`.
- Do not modify Phase 1 contracts in this task.
- Do not fix the deferred Phase 1 P0 defects in this task.
- Do not implement Reliance, Tata AIG, or HDFC adapters yet.
- Do not implement the runtime rating engine.
- Do not produce a production-approved canonical rule bundle.
- Do not hardcode the sample answer or use the sample filename to choose a row.

## 10. Deliverables

- Go Digit SATP adapter source code.
- Adapter-specific Zod schemas/types.
- Real-corpus normalized draft JSON.
- Human-readable `GO-DIGIT-ADAPTER-REPORT.md`.
- Automated unit and real-corpus tests.
- README describing scope and limitations.

## 11. Definition of done

Phase 2B Go Digit adapter is complete only when:

- The real source workbook is read through Phase 2A IR.
- All RTO 4WTP mappings and all SATP rows in scope are represented with source citations.
- The sample path is traceable to `UP78 → UP_Bad → Petrol>1000 → Age All → 4W SATP row 293`.
- `Max CD2` remains unresolved and never appears as approved TP commission.
- `All_India_Decline` is not interpreted as 0% commission.
- Unclear note exceptions are preserved and not over-applied.
- Tests and typecheck pass with actual outputs recorded.
- No Phase 1 or Phase 0 source files are modified.
