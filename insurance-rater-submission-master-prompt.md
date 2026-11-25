# Insurance Rater Agent — Fast-Track Submission Master Prompt

> **Purpose:** Give Codex one coordinated instruction to take the current repository from the completed source-ingestion/adapter work to a submission-ready hosted application. Execute work in dependency order, preserve evidence, and do not trade correctness for speed.
>
> **Important:** This prompt authorizes implementation across the remaining project phases. It does **not** authorize invented commission rates, fabricated evidence, bypassing persistence, committing secrets, or claiming deployment/tests succeeded when they did not.

---

## 0. Your role and execution mode

You are the primary implementation engineer for the Insurance Rater Agent project. ChatGPT is acting as technical lead; the repository and this prompt are the implementation source of truth.

The project owner needs to submit today. Work efficiently and autonomously:

1. Inspect the complete repository and current Git status before editing.
2. Read the root `AGENTS.md`, all Phase 0 rulebooks, current Phase 1 contracts/audit notes, Phase 2A source-reader code and real inventory, and both existing adapter packages.
3. Build a concise task plan based on the actual repository, then execute it in dependency order without asking for approval at every phase.
4. Preserve working code. Prefer additive changes and small, reviewable commits.
5. If credentials, hosted-service access, or a truly missing authoritative source prevents a task, implement everything else that can be completed safely, record the blocker, and provide exact manual steps. Do not pretend the blocked task is complete.
6. Do not stop merely because an optional enhancement is uncertain. Use `UNSUPPORTED`, `AMBIGUOUS`, or an explicit unresolved stage where appropriate.
7. Do not perform destructive operations, rewrite history, delete source data, or overwrite user files without explicit approval.

At the end, provide a precise completion report with changed files, commands, exit codes, test counts, deployment URL (only if actually deployed), and remaining blockers.

---

## 1. Project objective

Build a browser-based, explainable Insurance Rater Agent that:

- accepts motor insurance policy PDFs, including previously unseen layouts;
- extracts policy facts with page-level evidence;
- selects the correct insurer commission-grid version using documented effective-date rules;
- maps policy dimensions such as RTO and make/model;
- applies insurer-specific commission conditions, exclusions, declines, slabs, adjustments, and precedence deterministically;
- returns OD, TP, or package commission rate scope and applicability;
- shows exact source file/page/sheet/cell citations and an ordered decision trace;
- explicitly returns `UNSUPPORTED` or `AMBIGUOUS` when evidence is insufficient;
- stores uploaded files and completed analyses durably across browser refreshes, sign-out/sign-in (if auth is used), service restarts, and redeployments;
- exposes the workflow through a hosted browser frontend;
- includes tests, README, setup/deployment instructions, four sample-policy traces, and an architecture/assumptions/failure-modes note.

This is not a customer premium calculator. The required result is the applicable broker brokerage/commission percentage. Rupee payout calculation is optional and must remain separate from rate determination.

---

## 2. Current project state — verify before relying on it

The following is the latest reported state. Confirm each item in the actual repository rather than assuming it is true.

### Phase 0

- Four insurer rulebooks exist under `docs/phase-0/` (or the current equivalent): HDFC ERGO, Go Digit, Reliance IndusInd, Tata AIG.
- A consolidated Phase 0 report exists.
- Source interpretations and owner clarifications are documented. Keep source-derived facts distinct from project-owner clarifications.

### Phase 1

- TypeScript/Zod canonical contracts exist under `phase-1/`.
- A first P0 implementation was made and reported as typechecked/tested.
- A second read-only audit identified remaining contract gaps: no per-policy `RuleMatchResult`; inconsistent provenance/confidence on missing/invalid/ambiguous facts; payout stages missing formula/typed inputs/stage evidence; grid-selection cross-field validation incomplete; incremental COA calculation invariants incomplete.
- **The project owner previously asked to defer the remaining Phase 1 P0 contract defects. Do not perform a broad Phase 1 refactor.** If runtime integration needs a missing concept, prefer a small adapter/runtime contract in a new package. Modify Phase 1 only if technically unavoidable; explain why and minimize the change.

### Phase 2A

- Raw Excel/PDF readers and `GridDocumentIR` exist under `phase-2a/`.
- Manifest support covers the actual `MANIFEST.json` structure: `formatVersion`, `contents`, `files[]`, with `path`, `bytes`, `sha256`.
- Integrity verification is separate from parsing. All manifest entries are verified; only files under `raters/` are parsed as insurer grids. Sample-policy PDFs are integrity-verified but not sent to grid PDF parsing.
- The real corpus was reported as 10/10 manifest entries verified; 3 workbooks and the 2-page HDFC PDF inventoried; 29 workbook sheets; no commission rules emitted.
- Synthetic tests were reported as 15/15 passing. Re-run tests in the current environment and verify the real inventory still exists.
- A Reliance `Enabler, PO Guidelines & T&C` dimension mismatch was reported: Phase 2A IR showed `A3:B62` while previous source inspection expected `A3:J62`. Preserve and investigate this discrepancy; do not silently discard columns or re-open XLSX inside an adapter to bypass Phase 2A.

### Phase 2B adapters

**Go Digit SATP adapter** under `phase-2b/`:

- Reported source identity/hash verification succeeded.
- Draft represented 1,722 RTO mappings, 326 SATP rows, 80 decline mappings, 6 decline rows, 10 unresolved note exceptions, and 119 formula keys.
- Sample trace: `UP78 → UP_Bad → Petrol>1000 → Age All → 4W SATP!B293:F293`.
- `Max CD2` remains an uninterpreted raw metric; no approved commission rate is emitted. Do not turn `0.295` into an approved 29.5% commission.
- Reported typecheck/build and 20 tests passed in an isolated Windows copy. Verify current generated outputs and test status.

**Reliance private-car adapter** under `phase-2b-reliance/`:

- Reported source hash verification: 1,928,494 bytes; SHA-256 `50cd340b3ea5917d4fc6d55e720c14405f26d5076c059414b69a6c03ea7b3142`.
- Draft represented 8 sheets, 1,501 RTO mappings, 535 make/model mappings, 15 private-car matrix rows, and H2:H6 terms.
- Sample policy issue date: `2025-12-12`; supplied workbook/file labels are `FEB 26` and private-car sheet title `Pvt Car Old Business Grid - Jan-26`. Exact effective bounds are not evidenced. Sample must remain `UNSUPPORTED` with `NOT_COVERED_FROM_AVAILABLE_EVIDENCE`; no latest-grid fallback and no final rate/payout amount.
- Sample facts: `UP16 → Delhi / T20 / NORTH`; `RENAULT / KWID → SMALL`, but `SMALL` is not a rate-matrix column; fuel and previous insurer remain missing/unverified; OD premium ₹4,714; liability ₹2,519; package ₹7,233; GST ₹1,302.
- H2 says payout on OD Premium. H3 `<1000 CC` 5% lesser is project-owner clarified as a relative multiplier `0.95` (not minus five percentage points), clarification date `2026-11-23`. H4 standalone ZD 2.5% reduction unresolved; H5 Extended Warranty flat 20% basis/operation unresolved; H6 Tyre/RTI additional 2.5% conditional and basis unresolved.
- Reported 32 tests, typecheck, and build passed. There is a Phase 2A dimension discrepancy in `Enabler, PO Guidelines & T&C`; do not silently treat the sheet as fully interpreted.

### Source corpus

Expected source root: `data/source-corpus/` containing `MANIFEST.json`, `raters/`, and `sample-policies/`. The manifest had 10 entries and previously verified 10/10. Use the actual original source documents and inventory output. Never modify source files or the manifest.

---

## 3. Non-negotiable business and evidence rules

### Global

- No answer may be generated from an LLM's unsupported interpretation of a commission table.
- LLMs may assist policy-fact extraction; commission selection and arithmetic must be deterministic and tested.
- Every extracted policy fact must preserve raw value, normalized value, fact status, provenance, and available evidence.
- Every mapping, matched rule, excluded/declined rule, adjustment, and rate must retain exact source evidence.
- Preserve original workbook sheet names, cell addresses/ranges, PDF page numbers, source filenames, manifest SHA-256, and parser/extractor versions.
- A candidate rate is not automatically an approved rate. Keep candidate, selected, effective, withheld, and final stages distinct.
- Do not silently deduplicate conflicting mappings or choose the “closest” rule.
- Do not interpret an explicit zero as missing or not applicable.
- For stand-alone TP, OD is `NOT_APPLICABLE`, not `0%`.
- Keep process lifecycle separate from business decision status.
- Never fall back to the latest grid when the relevant date is not covered.
- Preserve source statements, owner clarifications, and implementation assumptions as distinct provenance categories.

### HDFC ERGO

- The supplied commission grid is a 2-page PDF effective from 1-Feb-2025 according to its source label. Verify exact source text and policy date selection before claiming applicability.
- Inspect both Zone 1 and Zone 2 tables, geography mappings, product categories, premium/GWP slab notes, NCB/fuel requirements, and all footnotes.
- The project owner clarified: when the grid states a `Package Rate`, apply it to eligible total package Net Premium = OD Net Premium + TP Net Premium, GST excluded; do not create a separate TP rate for that package rate. Where the grid explicitly specifies separate OD and TP rates, apply each to its own eligible premium component.
- **Do not conflate rate lookup slab basis with payout basis.** A grid may select a rate using GWP/other slab dimensions while calculating a package payout against OD+TP net premium.
- The HDFC policy fuel is not directly printed in the inspected policy schedule. Do not treat an unapproved external inference as policy evidence. If the rule requires fuel and no approved master/evidence is configured, return an appropriately unresolved result.
- Previous preliminary rate candidates are not approved expected answers. Re-derive from the original PDF and actual policy facts.

### Go Digit

- Preserve all in-scope 4W RTO and SATP mapping rows and explicit decline conditions.
- Keep `Max CD2` as a raw uninterpreted metric. Its semantic meaning was not established; it must not be exposed as OD/TP commission.
- `All_India_Decline` and specific decline rows are decline outcomes, not zero-percent commissions.
- The sample SATP OD component is `NOT_APPLICABLE`.
- No hardcoded answer for the sample filename.

### Reliance IndusInd

- Use policy issue date by default; use login/proposal date only if an authoritative source explicitly requires it.
- Do not infer precise effective dates from `FEB 26` or `Jan-26` labels.
- The supplied December 2025 sample is unsupported from the supplied later-labelled grid; no 22.5% or 21.375% as its final commission.
- Payout basis is OD Premium (source `PRIVATE CAR COMP, SAOD & STP!H2`).
- `<1000 CC` adjustment uses relative multiplier `0.95` (source H3 + project-owner clarification dated 2026-11-23).
- H4, H5, H6 remain unresolved/conditional unless additional authoritative content proves operation, basis, and eligibility.
- `SMALL` from model mapping is not a visible rate-grid column; do not invent a use for it.
- Previous insurer is missing in the sample; `existing Reliance customer = No` is not previous-insurer evidence.
- Do not infer fuel if not present in the policy or an explicitly approved external vehicle master.

### Tata AIG

- Inspect all workbook sheets, including hidden `pci checks` and `cv checks` sheets, but treat cached pivot data as stale where its source range is truncated (`Pvtcar!G5:BO131` while the current `Pvtcar` sheet extends further). Stale pivot zeros are not proof of zero incremental COA.
- Preserve the base `Pvtcar` grid separately from incremental COA, gross payout, settlement adjustments, and net payable.
- The sample base-grid candidate previously identified as 38% is not automatically the final payout. Verify policy issue/login date, month-specific grid, overrides, and all-inclusive status.
- Project-owner clarification: select active sheet according to the month of policy issuance (or a specifically defined login date); choose the highest-priority matching override in the owner-provided order `Special Deal → Specific Sub-segment → Standard Grid`; if the selected rule is not all-inclusive, add eligible incremental COA; keep gross payout and later TDS/GST/clawback/endorsement settlement adjustments as separate stages.
- Preserve the above as `PROJECT_OWNER_CLARIFICATION`, not as wording found in the workbook. Do not invent missing precedence mappings, GWP thresholds, producer GWP, accounting formulae, or settlement signs. If a necessary input/evidence is absent, keep the applicable stage pending and explain why.
- SATP OD is `NOT_APPLICABLE`.

---

## 4. Immediate goal: finish the four insurer adapter drafts

First inspect the actual repo and current outputs. Then complete the two remaining adapters:

### 4A. HDFC ERGO adapter

- Create an isolated package following existing adapter conventions, e.g. `phase-2b-hdfc/`.
- Consume Phase 2A PDF `GridDocumentIR`; do not re-open/reparse the original PDF inside the adapter.
- Normalize both pages, all rate tables, geography mappings, product categories, slabs, footnotes, and relevant notes.
- Reconstruct table/header context only where supported by Phase 2A IR. If text coordinates exist but table structures do not, build a deterministic layout reconstruction using documented geometric rules and tests; otherwise stop and report the IR limitation. Do not fabricate row/column coordinates.
- Preserve PDF page, text item/bounding box, table/row identity (if deterministically reconstructed), and source file hash.
- Represent package rate vs separate OD/TP rate, rate lookup basis vs payout basis, GST exclusion, NCB, fuel, geography, and slab dimensions independently.
- Do not emit an approved sample rate if a required policy fact is unresolved.

### 4B. Tata AIG adapter

- Create an isolated package, e.g. `phase-2b-tata-aig/`.
- Consume Phase 2A workbook IR; do not import ExcelJS or reopen the workbook in the adapter.
- Inspect all seven sheets and hidden checks; preserve formula/cached values/errors independently.
- Normalize the `Pvtcar` base grid with exact source cells and merged/header context.
- Normalize the relevant GWP/COA structures only where the actual workbook/IR contains sufficient evidence.
- Preserve the seven vehicle-type rows that have the 38% Delhi/CNG/Renewal/SATP base candidate; do not collapse them to a single generic record without retaining the matched rule IDs and invariant explanation.
- Preserve override hierarchy and detailed specificity as independent dimensions. Do not invent a mapping between them.
- Preserve the project-owner date-selection/override/COA process as separate owner-clarification provenance.
- Treat the old `pci checks` pivot cache as stale and do not use its zeros as current COA evidence.
- If producer GWP, threshold, active sheet, all-inclusive status, or override evidence is missing, do not calculate that stage.

### Adapter draft requirements

Each adapter must emit:
- source identity and SHA-256;
- complete sheet/page inventory and scope classification;
- mapping tables with complete in-scope rows and exact citations;
- rate tables and conditions with header ancestry;
- footnotes, decline, exclusions, and unresolved terms;
- a sample trace (not a hardcoded sample answer);
- warnings and unresolved semantic questions;
- `noApprovedCommissionRulesEmitted: true` until reviewed and promoted.

Do not modify original files, manifest, Phase 0 docs, Phase 1 contracts, Phase 2A, Go Digit adapter, or Reliance adapter while building these packages.

---

## 5. Minimal canonical integration and deterministic resolver

After all four adapter drafts exist, inspect whether the current Phase 1 contracts can safely consume them.

- Do not perform a broad Phase 1 P0 rewrite because the owner deferred it.
- Build a small, separately versioned runtime bridge package if needed, e.g. `packages/rating-runtime/` or `phase-3-runtime/`.
- The bridge must normalize all four adapter-specific drafts into a common deterministic resolver input while preserving insurer-specific extension data and source provenance.
- If a missing type blocks safe behaviour, add the minimum new Zod-validated runtime type in the new package; do not weaken validation or add untyped `any`/generic blobs.
- Implement date-based grid selection with explicit anchor kind, anchor date, selected bundle/source, effective interval, coverage result, and reason. Unknown effective bounds must not be treated as covered.
- Implement per-policy `RuleMatchResult` in the runtime package, not as static metadata on a commission rule. It must include rule ID, outcome (`MATCHED`, `DECLINED`, `EXCLUDED`, `OVERRIDDEN`, `MISSING_DATA`, `NOT_APPLICABLE` as relevant), matched conditions, failed/missing conditions, priority information, and evidence.
- Mapping outcomes must distinguish unique match, no match, and conflicts.
- Evaluate declines/exclusions before accepting a candidate rate.
- Resolve OD, TP, and package scope separately. Package rate must not be duplicated as a TP rate.
- Keep candidate rates distinct from approved/effective rates.
- Do not apply unresolved Go Digit, Reliance, or Tata adjustments.
- Generate ordered decision traces with exact evidence for each transformation.
- Confidence must be based on evidence quality and deterministic resolution, not raw LLM self-reported confidence.
- When any required dimension or source coverage is missing, return `UNSUPPORTED` or `AMBIGUOUS`, not a guessed result.

The resolver must be deterministic: the same normalized facts and versioned rule bundle must produce the same result and trace.

---

## 6. End-to-end policy document processing

Build a backend processing workflow that works for arbitrary additional policy PDFs, not only the four supplied samples.

### Document pipeline

1. Validate uploaded file type, actual PDF signature/content, size limits, and page count.
2. Store original bytes in persistent object storage.
3. Extract PDF text page-by-page using PDF.js and retain page coordinates.
4. Detect low-text/scanned pages. Use an OCR provider behind a clean interface; preserve OCR engine/version, page, text block, and confidence/geometry if available.
5. Use structured LLM extraction only for policy fact extraction. Do not ask the LLM to choose commission rows or calculate commission.
6. Validate every extracted fact against page text/OCR evidence. Invalid quotes or missing page references must not become verified facts.
7. Normalize values (RTO, fuel, CC, insurer aliases, dates, premium components) without changing their meaning.
8. Resolve business type from explicit policy evidence and the project rule: current insurer same as previous insurer => renewal. Different insurers alone do not prove new business or rollover.
9. Keep `MISSING`, `INVALID`, and `AMBIGUOUS` fact states distinct.
10. Save intermediate stages safely so a retry does not unnecessarily repeat completed extraction.

### Provider/configuration constraints

- Inspect existing dependencies and configuration first; reuse what is sound.
- Keep OCR and LLM providers behind interfaces.
- Read API keys only from environment variables/secret manager. Never commit secrets.
- Provide `.env.example` with names only, no values.
- If OCR/LLM credentials are unavailable, still implement the provider interface, deterministic validation, and clear UI state; do not claim scanned policy extraction is operational until tested with a real configured provider.
- The four supplied policies are scanned/image-heavy, so test OCR on all four.
- Handle corrupt, encrypted, oversized, unsupported, empty, and low-quality PDFs gracefully.

---

## 7. Hosted application, storage, and history — baseline acceptance requirements

The hosted frontend, arbitrary additional policy upload, and persistent saved-run history are mandatory. Do not ship a local-only demo as complete.

### Storage boundaries

- Use managed PostgreSQL for users, document metadata, runs, extracted facts, results, citations, decision traces, processing events, and ruleset versions.
- Use durable S3-compatible object storage (AWS S3/R2 or existing managed equivalent) for original uploaded PDFs and any generated durable artifacts.
- Never rely on container-local filesystem, `/tmp`, browser localStorage, React state, or ephemeral volumes as the sole source of persisted uploads/history.
- Store object keys and checksums in PostgreSQL; keep buckets private and issue short-lived authorized download URLs.
- Document exactly where data is stored and why it survives restarts/redeployments.

### Background processing

- Use the existing queue if present. Otherwise use a persistent queue compatible with chosen infrastructure (PostgreSQL-backed queue is acceptable).
- API request should enqueue a run and return its ID; worker performs extraction and rating.
- Processing states: `UPLOADED`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`.
- Decision states: `RESOLVED`, `UNSUPPORTED`, `AMBIGUOUS`.
- A completed processing run may legitimately have an unsupported/ambiguous decision.
- Add retries, idempotency, duplicate-job protection, and failure visibility.

### Required browser flow

1. Reviewer opens hosted application.
2. Uploads a motor policy PDF not necessarily present in sample corpus.
3. Sees upload and processing status based on persisted backend events.
4. Receives extracted policy facts, status, OD/TP/package rates and explicit applicability, citations, confidence reasons, and ordered decision trace.
5. Can click a PDF citation to open the correct PDF page.
6. Can inspect an Excel citation by workbook/sheet/cell range and see the normalized source cell/row excerpt; original workbook remains available for download if permitted.
7. Can view previous runs after refresh, closing/reopening browser, authentication round-trip (if auth is used), API/worker restart, and redeployment.

### Minimum data model

At minimum persist:
- user/session owner (or controlled reviewer workspace identity);
- policy document record (filename, object key, MIME, size, SHA-256, page count, timestamps);
- analysis run (processing status, decision status, selected ruleset, extractor/parser versions, timestamps);
- extracted facts with field-level evidence;
- OD/TP/package component result and applicability;
- rule matches and rejected candidates;
- decision trace;
- confidence reasons;
- structured unresolved issues;
- immutable source/ruleset version references.

### Security and privacy

- Keep uploaded customer policy files private.
- Validate actual MIME/signature; protect against path traversal and oversized/malicious PDFs.
- Do not expose public predictable object URLs.
- If using authentication, persist history by user identity. If using a demo access code, keep it server-side and protect reviewer data; do not hardcode credentials.
- Avoid logging policy PII, full OCR text, tokens, or secrets unnecessarily.
- Add rate limits and basic abuse protection to public upload endpoints.

---

## 8. Frontend requirements

Build a polished but focused reviewer UI. Prioritize functionality over animation.

Pages/sections:

1. **Dashboard/upload** — drag-and-drop/select PDF, validation, upload progress, recent runs.
2. **Processing view** — actual persisted stage updates; no fake percentages.
3. **Analysis result** — policy summary, decision status, OD/TP/package rates, applicability, confidence reasons, unresolved issues.
4. **Decision trace** — ordered steps, each with input, transformation, result, and citations.
5. **Evidence viewer** — PDF page navigation and spreadsheet cell/range evidence display.
6. **History** — previous files and runs, filtering/search if practical.

Do not render a percentage when rate is unknown or unresolved. Do not show `0%` for not-applicable OD. Clearly distinguish candidate rate, source field, resolved commission rate, and payout amount.

---

## 9. Tests and acceptance strategy

Write and run:

### Unit tests
- manifest and source integrity;
- each adapter parser and complete table row counts;
- date selection and no-fallback behavior;
- RTO/make-model mappings;
- exact/enum/range/premium-slab conditions;
- inclusive/exclusive boundaries;
- declines and exclusions;
- overlapping/conflicting rules;
- package vs OD/TP scope;
- adjustments and unresolved terms;
- evidence reference validity;
- deterministic trace output.

### Golden fixture tests

Run all four supplied policies through the real pipeline using the original source corpus. Compare to manually reviewed expected facts and evidence. Do not hardcode rates by filename. The expected answer may legitimately be unsupported/ambiguous where the supplied evidence is insufficient.

Known guardrails:
- Go Digit `Max CD2` is not an approved rate.
- Reliance Dec-2025 sample cannot use later Jan/Feb-2026-labelled grid without authoritative effective-date evidence.
- Tata stale pivot-cache zeros are not proof of zero COA.
- HDFC fuel must have acceptable evidence if required by the applicable rule.
- Package rate applies to the eligible OD+TP net premium, GST excluded, and must not create separate TP commission.

### Unseen-policy tests

Add tests for additional PDFs with different layouts, low text, OCR, missing fields, invalid values, conflicts, unsupported insurer, unsupported vehicle segment, and missing grid coverage. At least one test must use a policy PDF not among the four supplied fixtures (synthetic or legitimately sourced test fixture).

### Storage boundary tests

Verify uploaded PDF and completed analysis survive:
- browser refresh;
- close/reopen;
- sign-out/sign-in if auth enabled;
- API restart;
- worker restart and pending-job recovery;
- application/container redeploy.

Use integration tests against the actual chosen storage/database boundary where feasible. Do not mock away all persistence tests.

### Commands

Run from each package or workspace root as appropriate:
- `npm run typecheck`
- `npm test`
- `npm run build`
- adapter normalization commands
- backend/frontend production builds

Record exact command, working directory, exit code, test files, test counts, and any warnings. A command that was not executed must be marked not run.

---

## 10. Deployment and submission

Inspect the actual repository and choose a deployment platform consistent with existing project configuration. Recommended boundaries:
- frontend static hosting;
- API service;
- worker process;
- managed PostgreSQL;
- persistent S3-compatible object storage.

Create deployment configuration and `.env.example`. Add health checks and a concise operations section.

If provider credentials, domain access, database URL, storage credentials, OCR/LLM keys, or hosting permissions are not available:
- do not invent them;
- finish all local code/configuration/tests possible;
- give the project owner the exact missing variables/actions;
- do not claim that the app is deployed or that unseen PDFs work in production.

The submission must include:
- hosted application URL (only if genuinely deployed and tested);
- source-code repository URL (do not invent it);
- README with setup/run/deploy instructions;
- architecture, assumptions, trade-offs, and failure modes;
- storage location and persistence explanation;
- automated rating logic and storage-boundary tests;
- four decision traces that are accessible in the UI or directly linked in the repository;
- reviewer credentials/access instructions if authentication is required (never commit secrets).

Prepare an email draft to `careers@vaatun.com` with subject `Insurance Rater Agent Challenge Submission`, but do not send it automatically.

---

## 11. Execution priority under the same-day deadline

Work in this exact priority order. Keep the implementation minimal but correct.

### Priority 0 — Submission blockers

1. Inspect current repository, Git status, package scripts, existing adapter drafts and real inventory.
2. Complete HDFC and Tata AIG adapter drafts with exact citations and no invented rates.
3. Build a minimal deterministic runtime bridge/resolver that consumes all four adapter drafts and produces structured sample traces.
4. Implement durable backend upload, PostgreSQL records, object storage, history retrieval, and processing status.
5. Implement OCR/structured extraction provider interfaces and verify all four supplied PDFs; do not claim production OCR without successful real tests.
6. Implement the essential frontend upload/result/history/evidence flow.
7. Deploy if credentials are available and verify hosted upload + persistence.

### Priority 1 — Required quality gates

1. Golden tests for all four policies and deterministic rating cases.
2. Real storage-boundary tests.
3. README, deployment docs, assumptions/failure modes, four traces.
4. Dependency and security review. Do not mass-upgrade dependencies near submission; report advisories and upgrade only safe, compatible direct dependencies with tests.

### Priority 2 — Defer if time-constrained

- rich visual polish and animations;
- elaborate analytics dashboards;
- optional policy URL ingestion;
- uploading new commission grids;
- full accounting/net-settlement calculation where authoritative formulae are absent;
- broad Phase 1 contract redesign unrelated to the working submission path.

If time is insufficient for every priority, finish a truthful, testable baseline path and report missing acceptance criteria explicitly. Never downgrade correctness, evidence, or persistence to make the UI look complete.

---

## 12. Repository hygiene and Git

- Check `.gitignore` before adding files. Exclude `.env`, secrets, node_modules, temp PDFs, local databases, and generated user uploads.
- Commit logical milestones with descriptive messages if Git is initialized; do not rewrite history or force-push.
- Preserve original source corpus as immutable inputs. If the source corpus is intended to be committed, confirm repository privacy and size policy first; otherwise provide reproducible local setup instructions and a checksum manifest.
- Keep adapter-generated drafts, rule bundles, and approved rule bundles in separate directories/states.
- Do not mark a draft as approved automatically. Use explicit review/promotion metadata.

---

## 13. Final report required from Codex

Create `SUBMISSION-READINESS-REPORT.md` at the repository root containing:

1. Current architecture and implemented components.
2. Four adapter statuses: draft/validated/approved and unresolved terms.
3. Four sample policy outcomes with status, component applicability, exact evidence, and reasons. Do not invent missing rates.
4. Hosted URL and deployment verification evidence, or exact blockers.
5. Persistence design and test results.
6. OCR/LLM configuration and real-PDF test results.
7. Exact commands, working directories, exit codes, test counts, build results.
8. Git status and important commits.
9. Security/dependency advisories and treatment.
10. Remaining gaps against every baseline challenge requirement.
11. Exact manual actions the project owner must perform before sending the submission.

Also create `SUBMISSION-EMAIL-DRAFT.md` with the correct subject, placeholders for actual hosted URL/repository URL, reviewer credentials (if applicable), and direct links to the four traces. Do not invent URLs or credentials and do not send the email.

## 14. Definition of done

The project is submission-ready only if all applicable baseline criteria are genuinely met:

- Hosted browser frontend works.
- Reviewer can upload additional policy PDFs, not just the four sample fixtures.
- Result shows status, OD/TP/package rate scope and applicability, citations, confidence reasons, and decision trace.
- Previous uploaded PDFs and completed analyses survive refresh, close/reopen, auth round-trip (if used), restarts, and redeployments.
- Source code repository is ready to share.
- Setup/run/deployment README exists.
- Rating logic and storage-boundary tests pass.
- Four sample traces exist and are accessible.
- Assumptions, failure modes and trade-offs are documented.

Do not report “complete” if any mandatory baseline item is unverified. Report `IMPLEMENTED`, `TESTED`, `DEPLOYED`, and `VERIFIED` as distinct states.

**Start now by inspecting the repository and writing a short execution plan, then proceed through the priority list.**
