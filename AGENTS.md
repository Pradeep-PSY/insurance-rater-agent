# AGENTS.md — Insurance Rater Agent

## 1. Project objective

Build an explainable insurance brokerage/rating agent for Indian motor policies.

The application accepts a motor-policy PDF, extracts relevant policy facts, selects the applicable insurer commission grid, resolves its mappings and conditions deterministically, and returns a structured result with exact evidence and a human-readable decision trace.

The system must return one of these business decision statuses:

- `resolved`: every applicable rate requested by the challenge is supported by one unambiguous, applicable rule and sufficient evidence.
- `unsupported`: the supplied evidence/rule corpus does not cover the case, or the correct grid version is unavailable.
- `ambiguous`: facts/rules conflict, an essential meaning is undefined, or more than one outcome remains possible.

Do not invent a rate to avoid an unsupported or ambiguous result. A correct evidence-backed refusal is a valid result.

## 2. Source-of-truth and provenance policy

Keep these source classes distinct in code, data, reports, and UI:

1. **Original challenge sources**: the uploaded policy PDFs, original insurer XLSX/PDF rate grids, `challenge.md`, `README.md`, and `MANIFEST.json`.
2. **Project-owner business clarifications**: interpretations supplied by the project owner in the conversation. These are approved business inputs, but they are not quotations from the insurer documents.
3. **External corroboration**: information from a separately approved vehicle master or other external source. Never label it as information extracted from the policy PDF.
4. **Engineering decisions**: implementation choices such as schema shape, storage strategy, parser behavior, or confidence rubric.

Every normalized mapping, condition, rate, exception, and transformation must retain source provenance. For spreadsheets, preserve workbook, sheet, and exact cell/range. For PDFs, preserve filename and page; include table/row or quote where available.

If an owner clarification appears to conflict with an original insurer source, do not silently reconcile it. Record the conflict and require review.

Do not change, rename, or overwrite original source files. Verify manifest hashes when working with the supplied source bundle.

## 3. Mandatory domain rules

### 3.1 Policy components and rate scope

- OD means Own Damage; TP means Third Party.
- Comprehensive/package policies contain OD and TP components.
- Stand-alone TP (SATP) contains TP only. OD must be `not_applicable`, never `0%`.
- A grid can publish separate OD and TP rates, or one package-level rate. These are different rate scopes.
- Per project-owner clarification for the supplied HDFC interpretation: a **Package Rate** is applied once to total net package premium (OD net premium + TP/liability net premium), excluding GST. Do not additionally apply a separate TP percentage. Do not mislabel a package rate as an OD rate. Component rates should be represented as not separately specified when both covers exist but the source gives one package-level percentage.
- Keep the **grid-selection/slab basis** distinct from the **payout basis**. They may differ.
- Store percentage and money values without binary floating-point arithmetic. Prefer decimal strings in persisted contracts and a decimal arithmetic library for calculations.

### 3.2 Business type

The challenge explicitly states: when current insurer and previous insurer are the same, classify as `renewal`.

Do not infer `new_business` or `rollover` merely because the current and previous insurers differ. Use explicit policy/source evidence or leave the business type unresolved if the selected grid requires it.

Preserve unusual policy history (for example, a coverage gap) as context. Do not silently override the challenge's same-insurer renewal rule.

### 3.3 Policy facts and evidence

- Facts must be field-level, not just one confidence score for the entire policy.
- Preserve raw extracted text and normalized value separately.
- Preserve evidence source class (policy PDF, external vehicle master, user clarification, etc.).
- A value inferred from a vehicle model must not be represented as printed policy data.
- If a PDF contains an invalid placeholder (for example, manufacture date `0001-01-01`), preserve the raw value and mark it invalid/unusable; do not turn it into a real year.
- Missing, conflicting, invalid, and externally corroborated facts are distinct states.
- LLM output is not evidence by itself. Validate its quote/page reference against extracted page text or OCR output and preserve OCR provenance.
- Only ask for a clarification when the missing/ambiguous fact is actually required by the selected rules.

### 3.4 Grid selection and dates

- Grid/version selection is a first-class deterministic step and must happen before rate matching.
- Default anchor is policy issue/issuance date. Use login/proposal date only where an authoritative insurer instruction defines it as the anchor.
- Never apply the newest available grid merely because it is the newest file.
- Never apply a later grid retrospectively without explicit source authorization.
- If no supplied grid covers the anchor date, return `unsupported` (or `ambiguous` if the anchor itself is unclear); do not guess.
- Store the selected grid bundle/version and anchor date in every analysis result.

### 3.5 Matching and exceptions

- Use exact, explicit insurer-specific mappings and condition semantics.
- Do not use fuzzy/nearest-row matching for a final rate.
- Keep range endpoints and inclusive/exclusive semantics explicit.
- Evaluate footnotes, exclusions, declines, and overrides before accepting a candidate rate.
- A zero value is not automatically the same as a declined/not-covered case. Preserve source meaning; if unknown, withhold final interpretation.
- If multiple rules match with conflicting outcomes and the source gives no precedence, return `ambiguous`.
- If no eligible rule matches, return `unsupported`.
- Some insurer notes say “few RTOs” are declined without naming the RTOs. Do not turn these into blanket exclusions or assume the policy is eligible; retain the unresolved exception and flag when relevant.

## 4. Insurer-specific source-grounded constraints

The detailed evidence is in `docs/phase-0/`. Read the relevant rulebook before modifying insurer logic. The following are guardrails, not a replacement for those rulebooks.

### 4.1 HDFC ERGO — Private Car Comprehensive / Package

- Supplied grid PDF: effective from 1-Feb-2025; two-page PDF.
- Sample policy issue date: 26-Mar-2026.
- Policy is Private Car Comprehensive; use the Package table, not SAOD.
- Haryana maps to Zone 2 (grid PDF page 2).
- Sample's current NCB deduction is 35%; use the NCB column, not N-NCB.
- Sample net OD premium ₹8,053; net liability premium ₹3,816; total net package premium ₹11,869; GST ₹2,136 is separate.
- Package slab achievement is based on Comprehensive + SAOD GWP; SATP premium is excluded. Do not confuse this slab-selection basis with the package payout basis.
- The sample candidate is 17.50% for Zone 2 / Package / >10k–50k / Non-Petrol / NCB, subject to fuel provenance.
- Fuel is not printed on the policy schedule. An external vehicle reference corroborates Diesel, but unless an approved vehicle-master source is configured, fuel remains missing/unverified. Never pretend it came from the policy.
- Owner clarification: Package Rate applies to total net package premium (OD + TP/liability, GST excluded), once. Do not add a second TP rate. Component OD/TP rates are not separately specified.
- Do not calculate a final rate if required fuel evidence is not approved.

### 4.2 Go Digit — Private Car SATP

- Sample policy: issue 24-Mar-2026; cover 25-Mar-2026 to 24-Mar-2027.
- Policy facts include UP-78, Petrol, 1086 CC, Hyundai Santro New 1.1 MT Corporate, and Go Digit as both current and previous insurer.
- The policy manufacture-year field appears as `0001-01-01`; preserve as invalid/unusable. It does not block this sample match because the selected row has Age = `All`.
- SATP RTO lookup must use the `4WTP` mapping column, not Package/SAOD/PLR columns: `4W  RTO!B1609:C1609`, UP78 -> UP_Bad.
- `4W SATP` match: cluster UP_Bad + segment `Petrol>1000` + age `All`, row 293. `4W SATP!E293` raw numeric is about `0.295`, displayed as 29.5%, but the field header is `Max CD2`.
- The meaning of `Max CD2` is not defined in the supplied workbook. Project owner explicitly directed that its meaning be skipped. Preserve raw field name/value for audit only. Do not call it TP commission/brokerage and do not emit 29.5% as the final TP rate.
- The sample's commission result remains ambiguous/withheld pending authoritative field semantics. OD is `not_applicable`.
- Workbook age bands include `<10`, `>10`, and `All`; do not classify exactly 10 years into either adjacent band without a source rule.
- Some notes say “few RTOs” are declined without identifying them. Never turn these into blanket exclusions or assume eligibility if they may apply.
- `All_India_Decline` and zero values must not be treated as ordinary 0% commission without an authoritative definition.
- Grid's effective-from date is not clearly established in the inspected SATP sheet; do not invent one.

### 4.3 Reliance IndusInd — Private Car Comprehensive

- Sample policy issue/invoice date: 12-Dec-2025. Policy wording explicitly marks “Renewal of Policy”; previous insurer is not identified in inspected pages. Do not infer previous insurer.
- Policy: Renault Kwid 1.0 RXT O, UP-16, 999 CC, manufacture Oct-2020; OD premium ₹4,714; total liability premium ₹2,519; package premium ₹7,233; GST separate.
- Fuel is not printed on the inspected policy schedule. A separate external reference may corroborate Petrol; it is not policy evidence.
- Supplied workbook is February 2026 and its private-car sheet is titled Jan-26 Old Business Grid; it is later than the sample issue date. Do NOT apply it to the December 2025 sample. Sample rate is `unsupported` from supplied corpus because no contemporaneous applicable grid is provided.
- Do not use the newest available grid as a fallback.
- If a temporally valid version is later supplied: RTO mapping `RTO List!A1253:E1253` -> UP16 / Delhi / T20 / NORTH; make/model mapping `Make Model wise segment!A397:C397` -> RENAULT / KWID / SMALL. `SMALL` is not a visible base-rate column, so do not invent a segment adjustment.
- Candidate base row `PRIVATE CAR COMP, SAOD & STP!A11:F11`: NORTH/Delhi, Petrol/Bifuel/Comp = 22.5%. This is not a rate for the supplied December policy.
- `H2`: payout on OD Premium.
- `H3`: for `<1000 CC`, PO is 5% lesser. Owner clarification defines this as relative reduction: multiply base rate by `0.95` (not minus 5 percentage points). For a hypothetical valid 22.5% grid, adjusted candidate = 21.375%; do not return this as sample's final rate.
- H4 standalone ZD reduction, H5 Extended Warranty flat payout, H6 Tyre/RTI additional payout are separate conditional rules; do not apply without evidence and clarified operation.

### 4.4 Tata AIG — Private Car SATP

- Sample TP cover: 1-Apr-2026 to 31-Mar-2027; policy location Delhi / Zone A; CNG; 998 CC; body type Hatch Back; current and previous insurer Tata AIG; intermediary code 721; TP Net Premium ₹2,154; GST separate.
- Previous policy expired 30-Aug-2024, creating a coverage gap. Still apply challenge's explicit same-insurer -> Renewal rule; preserve the gap as context.
- `General Guidelines!C7` says Pvt Car SATP payout percentage is on Net Premium. Package/SAOD payout is on OD Premium.
- `Pvtcar!F1` says the private-car standard grid is applicable from policies dated 1-Nov-2025. Anchor selection must be policy issue date or insurer-defined login date if that is authoritative. Do not silently use cover start date as a substitute.
- Policy grid dimensions include Type, Business Type, Fuel Type, Section, NCB, Add On, and location.
- Sample known dimensions: Renewal + CNG + SATP + NCB All + Add On All + Delhi.
- Policy body type Hatch Back does not directly map to any of the seven grid Type categories. Do not invent Hatch Back -> Compact.
- All seven candidate rows (Pvtcar rows 511, 515, 519, 523, 527, 531, 535; Delhi column V) show 38.0%. The base standard-grid rate is invariant across all candidate Type categories, so the base rate can be represented as 38% with all seven candidate citations in the trace, without asserting a Type mapping.
- Base rate basis is Net Premium. OD is `not_applicable`.
- Higher-priority override order in detailed workbook guidance: policy-specific -> fleet-code -> PAN-specific -> code-specific -> standard grid. Owner also described high-level grouping: Special Deal -> Specific Sub-segment -> Standard Grid. Preserve both; do not silently collapse or reinterpret them.
- Owner clarification: if selected base rule is not all-inclusive, add eligible incremental COA; if all-inclusive, do not double-add. Need actual GWP slab, increment value, all-inclusive flag, and relevant producer GWP evidence before final all-in payout.
- Separate base rate, incremental COA, gross payout, settlement adjustments, and net payable. Do not assume all TDS/GST entries are deductions; use signed entries and authoritative tax/accounting semantics. Settlement adjustments must not alter the reported base commission percentage.
- Hidden `pci checks` pivot cache source is only `Pvtcar!G5:BO131`, while current `Pvtcar` data extends through row 568. It is stale/out-of-range for sample rows 511–535. Never use its cached zero values as proof of zero incremental COA.
- `General Guidelines!C17` wording appears inconsistent with the detailed priority list. Preserve and flag the source inconsistency.
- No supplied policy-specific/fleet/PAN/code override record is available for intermediary code 721. Standard grid is the only directly evidenced base rate; external override status remains unverified.

## 5. Architecture boundaries

Use a modular architecture. Keep domain contracts and deterministic rating logic independent from transport/UI/document parsing.

Suggested logical modules (adapt to the existing repository; do not reorganize blindly):

- `contracts`: TypeScript types and Zod schemas.
- `policy-extraction`: PDF text/OCR, LLM extraction, fact normalization and evidence validation.
- `grid-ingestion`: XLSX/PDF parsers and insurer-specific adapters.
- `rating-engine`: date/grid selection, mappings, deterministic rule matching, adjustments, exceptions, and OD/TP/package resolution.
- `evidence`: citation references and decision trace construction.
- `storage`: database, object storage, and job queue boundaries.
- `apps/web`, `apps/api`, `apps/worker`: application surfaces if/when present.

The deterministic rating engine must not import or call an LLM. It should receive validated facts and a versioned rule bundle, then return a deterministic result and trace.

LLMs may assist policy fact extraction and possibly source-document ingestion, but cannot invent mappings, choose a closest rule, define an unknown column, or decide a final rate without an explicit deterministic rule.

Do not introduce a vector database for exact rate lookup. Semantic search may help locate source text, but final matching must use normalized exact conditions and explicit range semantics.

## 6. Contract design requirements

- Use strict TypeScript. Avoid `any`; use discriminated unions for statuses and rule kinds.
- Use Zod (or the repository's existing runtime validator) at external/data boundaries.
- Keep raw and normalized values separate.
- Represent source provenance explicitly, including `sourceKind` such as policy PDF, insurer grid, owner clarification, or external reference.
- Support multiple evidence references for one fact/rule/result.
- Preserve source cell coordinates and PDF page numbers.
- Represent `rateScope` separately from `premiumBasis`.
- Support package-level rates without fabricating separate OD and TP percentages.
- Support a component applicability state that distinguishes `not_applicable` from `not_separately_specified` and from `unresolved`.
- Separate base rate, rate adjustments, incremental COA, gross payout, settlement adjustments, and net payable.
- Represent adjustment operations explicitly (`MULTIPLY_RATE`, `ADD_PERCENTAGE_POINTS`, `ADD_FIXED_AMOUNT`, etc.); never encode an ambiguous free-text operation as executable logic.
- Preserve raw unknown fields such as Go Digit `Max CD2` without assigning unsupported domain semantics.
- Separate processing lifecycle state (`uploaded`, `queued`, `processing`, `completed`, `failed`) from decision status (`resolved`, `unsupported`, `ambiguous`).
- Confidence must be evidence-based and cannot override failed matching, missing grid coverage, or exclusions.

## 7. Coding and testing standards

- Inspect the existing repository and package manager before adding dependencies or changing scripts.
- Follow the repository's existing style and naming unless there is a strong reason to change it.
- Keep functions small and pure where possible; especially keep the rating engine deterministic.
- Do not hardcode answers for the four sample PDFs or route by filename. Use the same extraction and rule-resolution pipeline for supplied and unseen policies.
- Add tests for boundaries, missing fields, contradictory mappings, overlapping rules, stale/invalid grid dates, exceptions, and unsupported/ambiguous outcomes.
- Add golden fixtures for all four sample policies, but store them as expected test data only—not as production lookup logic.
- Include tests that assert Go Digit `Max CD2` is not emitted as a TP commission rate.
- Include tests that assert Reliance's later grid is not selected for the December 2025 policy.
- Include tests that assert HDFC Package Rate is applied once to total net package premium, excluding GST.
- Include tests that assert Tata AIG base rate, incremental COA, gross payout, and settlement are separate stages.
- Test SATP OD as `not_applicable`, not `0%`.
- Do not claim tests passed unless you actually ran them and report the command/output.

## 8. Security and data handling

- Treat uploaded PDFs and extracted text as untrusted input.
- Validate actual PDF content, not only filename or browser MIME type.
- Do not execute macros, embedded scripts, or spreadsheet formulas from untrusted files.
- Do not expose secrets, tokens, signed URLs, or personal policy data in logs.
- Never commit `.env`, API keys, credentials, or private uploaded policies.
- Keep source policy PDFs and grid files immutable; write derived artifacts separately.
- Do not add or configure a remote repository or deploy without explicit approval.

## 9. Required Codex workflow for every task

1. Read this file and the relevant Phase 0 rulebook(s).
2. Inspect the actual repository state before making assumptions.
3. Identify the exact files to change and explain the planned change briefly.
4. For non-trivial or destructive changes, ask for approval before editing.
5. Make the smallest coherent change; do not refactor unrelated code.
6. Run relevant formatter, typecheck, and tests using the repository's actual scripts.
7. Report changed files, commands run, pass/fail results, remaining risks, and any assumptions.
8. Show a diff summary. Never claim success for an unrun command.

## 10. Current project milestone

Current milestone: **Phase 1 — Canonical Data Contracts**.

The first task is to inspect and validate the drafted Phase 1 contracts against all four policy examples and the four Phase 0 insurer rulebooks. In particular, review the `PolicyFacts` contract before implementing extraction or rating logic.

Do not begin building the PDF upload frontend, LLM pipeline, or rating engine until the contracts have been reviewed and accepted.
