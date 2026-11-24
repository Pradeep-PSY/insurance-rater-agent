# Phase 1 – Contract Design Decisions

## 1. Design goal

Create one stable internal data language for all insurers without pretending that their commission models are identical. The contract layer validates shape and provenance; the rating engine (a later phase) interprets the rules.

## 2. Source-specific modelling decisions

### HDFC ERGO

- Model the Package rate as `rateScope: PACKAGE`.
- Its payout basis is `TOTAL_NET_PACKAGE_PREMIUM`, which the owner defined as OD net premium + TP/liability net premium, with GST excluded.
- Keep **lookup/slab basis** separate from **payout premium basis**. The HDFC grid's slab achievement uses Comprehensive + SAOD GWP and excludes SATP; that does not change the owner-confirmed package payout basis.
- If a Package rate is selected, OD and TP are both part of the package but their separate rates are `NOT_SEPARATELY_SPECIFIED`, not zero and not not-applicable.
- Fuel provenance must be retained. The sample policy schedule does not print fuel; external vehicle-reference corroboration must not be disguised as a policy fact.

### Go Digit

- Model RTO-to-cluster and SATP segment mapping as separate `MappingRule` entries.
- Preserve the source cell `Max CD2` as a `RAW_METRIC` observation.
- Since the field meaning is unresolved and the owner asked to skip it, it must have `eligibleForCommissionOutput: false`. It must not become TP commission merely because Excel displays 29.5%.
- The sample's manufacture-year sentinel is invalid. Because the matched SATP rule says Age `All`, the invalid year does not block that particular row match; preserve the invalid fact rather than replacing it.
- The workbook filename/folder label is not an explicit effective-from date. Leave effective date unknown until supported by source evidence.

### Reliance IndusInd

- A relative 5% reduction is represented as `RELATIVE_ADJUSTMENT` with factor `0.95`; do not subtract five percentage points.
- Grid version selection happens before rate matching. Do not select a newer grid simply because it is available.
- The supplied later grid cannot be used for the December 2025 sample unless an authoritative retrospective-applicability rule exists.
- Keep the base rate and adjusted rate as separate calculation stages.

### Tata AIG

- Keep base rate, incremental COA, gross payout, settlement adjustments and net payable separate.
- Apply grid-month selection using policy issue date or the insurer-defined login date where specified.
- Preserve detailed source precedence: policy-specific → fleet-code → PAN-specific → code-specific → standard grid.
- Preserve owner-supplied high-level labels separately unless a verified mapping to the detailed workbook tiers exists.
- The `allInclusive` property must be nullable because the source may not establish it. Add incremental COA only when the selected rule is not all-inclusive and the increment is independently supported.
- A stale `pci checks` pivot is not evidence of a zero increment.
- TDS/GST/clawback/endorsement adjustments belong to a separate signed settlement ledger. Do not assume every tax entry is a deduction.

## 3. Evidence and facts

Every known fact carries:

- normalized value;
- original/raw value where available;
- provenance (`POLICY_DOCUMENT`, `COMMISSION_GRID`, `EXTERNAL_REFERENCE`, `OWNER_CLARIFICATION`, or `DERIVED`);
- one or more source references;
- confidence and, for derived facts, formula and input fact paths.

A fact can also be `MISSING`, `AMBIGUOUS`, or `INVALID`. This prevents missing or contradictory data from being silently converted to a usable value.

PDF citations require a page number. Excel citations require a sheet name and cell/range. External references require a URL. Owner clarifications require a clarification ID.

## 4. Rates and money

- Decimal strings are used for money, percentages and multipliers. This avoids relying on binary floating-point values for financial calculations.
- `ratePercent` is the approved effective rate. `candidateRatePercent` can preserve a source-supported candidate while the final decision is blocked.
- A raw metric is not an approved rate.
- `NOT_APPLICABLE` is not `0%`.
- Package rates do not create artificial OD and TP component rates.
- Commission rate, commission amount, incremental COA and net settlement are different concepts.

## 5. Date and versioning

A grid source records `effectiveFrom`, `effectiveTo` and the date anchor used for selection. Unknown dates remain null/`NOT_SPECIFIED`. The bundle explicitly disallows silent fallback to the latest grid. The rating engine must return unsupported/ambiguous when no valid version is evidenced.

## 6. Status semantics

Top-level challenge statuses remain:

- `RESOLVED`: all required applicable commission components have an evidence-backed approved rate.
- `UNSUPPORTED`: the required insurer/product/rule/version is not covered by supplied authoritative evidence.
- `AMBIGUOUS`: conflicting facts/rules or unresolved semantics prevent a unique approved result.

Component-level statuses additionally include `NOT_APPLICABLE`, `NOT_SEPARATELY_SPECIFIED` and `WITHHELD`.

## 7. Intentionally deferred to later phases

- Rule-engine execution and priority resolution.
- Policy extraction and OCR implementation.
- Database tables and API payload lifecycle.
- Currency rounding policy for optional commission amounts.
- Exact settlement accounting treatment for tax and clawback entries.
- Grid-ingestion adapters that populate these contracts.
