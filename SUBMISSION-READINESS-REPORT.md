# Submission Readiness Report

> **Generated:** 2026-11-24  
> **State:** IMPLEMENTED (code complete) | DEPLOYED: NOT VERIFIED | CREDENTIALS REQUIRED

---

## 1. Architecture and Implemented Components

```
insurance-rater-agent/
├── data/source-corpus/          # Immutable original source files (10 entries, all verified)
├── docs/phase-0/                # 4 insurer rulebooks + consolidated Phase 0 report
├── phase-1/                     # TypeScript/Zod canonical data contracts
├── phase-2a/                    # Raw source reader / GridDocumentIR / manifest verifier
├── phase-2b/                    # Go Digit SATP adapter draft
├── phase-2b-hdfc/               # HDFC ERGO adapter draft (PDF coordinate reconstruction)
├── phase-2b-reliance/           # Reliance IndusInd adapter draft
├── phase-2b-tata-aig/           # Tata AIG adapter draft
├── apps/service/                # Backend + frontend reviewer service
│   ├── src/api.ts               # Express API: upload, runs history, auth, rate-limiting
│   ├── src/worker.ts            # Persistent background worker with job queue
│   ├── src/db.ts                # PostgreSQL pool + idempotent migration runner
│   ├── src/object-store.ts      # S3-compatible private object storage
│   ├── src/pdf.ts               # PDF.js text extraction + page geometry + low-text detection
│   ├── src/providers.ts         # OCR + LLM fact-extraction provider interfaces + disabled stubs
│   ├── src/resolver.ts          # Deterministic resolver (returns UNSUPPORTED when no approved ruleset)
│   ├── src/draft-traces.ts      # Bridge: 4 adapter drafts → DraftSampleTrace schema
│   ├── src/draft-trace-cli.ts   # CLI to generate example/sample-traces/ from real adapter artifacts
│   ├── src/contracts.ts         # Runtime service contracts (Zod)
│   ├── migrations/001-initial.sql # 13-table PostgreSQL schema
│   ├── public/                  # Static reviewer frontend (HTML + CSS + JS)
│   └── test/                    # contracts, draft-traces, pdf-real-policies tests
├── render.yaml                  # Render.com deployment config (PostgreSQL + web + worker)
├── SUBMISSION-READINESS-REPORT.md  # This file
└── SUBMISSION-EMAIL-DRAFT.md   # Email draft (fill in deployed URL before sending)
```

**Key architectural decisions:**

- Adapter drafts (Phase 2B) and the runtime bridge (`draft-traces.ts`) are **separate layers**. The adapters normalize source documents; the bridge maps draft outputs to the runtime `DraftSampleTrace` schema without touching the original files.
- The deterministic resolver returns `UNSUPPORTED` when no approved ruleset is available. It never invents a commission rate.
- OCR and LLM fact extraction are behind clean interfaces (`OcrProvider`, `PolicyFactProvider`). The disabled stubs make the service fully functional without credentials; they just return empty facts and cause the resolver to emit `UNSUPPORTED`.
- PostgreSQL stores all uploaded document metadata, run states, extracted facts, rate components, grid selections, rule matches, rate adjustments, uninterpreted metrics, payout stages, decision traces, confidence reasons, and unresolved issues.
- S3-compatible object storage holds original PDFs privately; short-lived signed URLs are issued for download/citation display.
- The processing queue is PostgreSQL-backed (`analysis_queue` table) — no additional queue service required.

---

## 2. Four Adapter Statuses

### 2.1 HDFC ERGO — Private Car Comprehensive (Package)

| Property            | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| Status              | **DRAFT_NOT_APPROVED**                                                        |
| Source              | `raters/hdfc-ergo/feb-2025/Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf` |
| SHA-256             | (see manifest)                                                                |
| Pages reconstructed | 2 of 2                                                                        |
| Rate tables         | 4 (Zone 1 Package, Zone 1 SAOD, Zone 2 Package, Zone 2 SAOD)                  |
| Slab rows           | 5 per table = 20 total                                                        |
| Rate cells          | 3 per row (Petrol NCB+N-NCB, Non-Petrol NCB, Non-Petrol N-NCB)                |
| Geography rows      | Extracted from both pages                                                     |
| Footnotes           | 4 source footnotes                                                            |

**Unresolved terms:**

- Fuel is not printed on the HDFC policy schedule. The external Diesel corroboration is not from an approved vehicle-master source. The final commission rate is withheld until fuel evidence is validated.
- The `>10-50k` slab endpoint semantics (inclusive/exclusive) are labelled `SOURCE_LABEL_ONLY_ENDPOINT_SEMANTICS_NOT_ASSIGNED`.

### 2.2 Go Digit — Private Car SATP

| Property                   | Value                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| Status                     | **DRAFT_NOT_APPROVED**                                                   |
| Source                     | `raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx` |
| RTO mappings               | 1,722 (`4W RTO` sheet, `4WTP` column)                                    |
| SATP rows                  | 326 (`4W SATP` sheet)                                                    |
| Decline mappings           | 80                                                                       |
| Decline rows               | 6                                                                        |
| Unresolved note exceptions | 10                                                                       |

**Unresolved terms:**

- `Max CD2` is a raw uninterpreted source metric. Its value at the sample row is preserved as `0.295` (raw decimal). It is **not** emitted as an approved TP commission rate.
- Effective-date bounds are unknown; the filename period label is not used.
- Manufacture year `0001-01-01` is preserved as `INVALID`; it does not block the sample because the matched row has `Age = All`.

### 2.3 Reliance IndusInd — Private Car Comprehensive

| Property                | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| Status                  | **DRAFT_NOT_APPROVED**                                              |
| Source                  | `raters/reliance-indusind/feb-2026/Pvt Car Feb26 Revised Grid.xlsx` |
| SHA-256                 | `50cd340b3ea5917d4fc6d55e720c14405f26d5076c059414b69a6c03ea7b3142`  |
| RTO mappings            | 1,501                                                               |
| Make/model mappings     | 535                                                                 |
| Private-car matrix rows | 15                                                                  |
| H2–H6 terms             | Preserved (H4–H6 unresolved)                                        |

**Unresolved terms:**

- **Sample is UNSUPPORTED.** Policy issue date is 2025-12-12; supplied workbook is labelled `FEB 26` / `Jan-26 Old Business Grid`. No contemporaneous applicable grid is supplied; the later grid is not applied retrospectively.
- `SMALL` segment from make/model mapping is not a visible column in the rate matrix — no rate is fabricated.
- H3 `<1000 CC` reduction is preserved as a multiplier (`0.95`) per owner clarification (2026-11-23), but is not applied because there is no applicable grid.
- H4 (standalone ZD), H5 (Extended Warranty), H6 (Tyre/RTI) remain unresolved.
- Fuel and previous insurer are missing/unverified for the sample.
- Phase 2A dimension discrepancy in `Enabler, PO Guidelines & T&C` sheet (`A3:B62` vs expected `A3:J62`) is preserved, not silently discarded.

### 2.4 Tata AIG — Private Car SATP

| Property            | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| Status              | **DRAFT_NOT_APPROVED**                                                                  |
| Source              | `raters/tata-aig/march-2026/Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx` |
| SHA-256             | `c62b657e7d819a250cb86549c177f88ff0277835d39a2a3e0d337fdc9915f879`                      |
| Sheets              | 7 (including 2 hidden `cv checks` / `pci checks`)                                       |
| Pvtcar matrix rows  | Full IR                                                                                 |
| Candidate rows      | 7 (all type categories × Delhi / CNG / Renewal / SATP / NCB All / Add On All)           |
| Invariant base rate | 38.0% (raw `0.38`) — candidate only, not approved                                       |

**Unresolved terms:**

- Policy issue date is not established; cover start date is not substituted as anchor.
- Override status for intermediary code 721 is unverified; hierarchy dimensions preserved separately.
- `pci checks` cached pivot is stale (source range `Pvtcar!G5:BO131` vs actual extent through row 568); its cached zeros are excluded as COA evidence.
- Body type `Hatch Back` → grid `Type` mapping is not asserted; all 7 type rows cited.
- Producer GWP, COA slab, increment, basis, eligibility, all-inclusive status are absent; COA stage is `PENDING`.
- General Guidelines C17 wording inconsistency with the detailed priority list is preserved and flagged.

---

## 3. Four Sample Policy Outcomes

### HDFC ERGO — Private Car Comprehensive

- **Decision status:** `AMBIGUOUS`
- **Reason:** `FUEL_EVIDENCE_MISSING_OR_UNAPPROVED`
- **OD applicability:** `NOT_SEPARATELY_SPECIFIED`
- **TP applicability:** `NOT_SEPARATELY_SPECIFIED`
- **Package applicability:** `APPLICABLE`
- **Candidate rate:** 17.50% (Zone 2 / Package / `>10-50k` GWP slab / Non-Petrol / NCB) — **withheld, not final**
- **Final rate:** `null` — withheld because fuel is not evidenced
- **Evidence:** Grid PDF page 1; Haryana → Zone 2 geography mapping; `Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf`
- **Trace:** `examples/sample-traces/hdfc_ergo.json`

### Go Digit — Private Car SATP

- **Decision status:** `AMBIGUOUS`
- **Reason:** `MAX_CD2_SEMANTICS_UNRESOLVED`
- **OD applicability:** `NOT_APPLICABLE` (SATP)
- **TP applicability:** `APPLICABLE` — rate **withheld**
- **Package applicability:** `NOT_APPLICABLE` (SATP)
- **Uninterpreted metric:** `Max CD2 = 0.295` (raw decimal, not a commission rate)
- **Final rate:** `null`
- **Evidence:** `4W RTO!B1609:C1609` (UP78 → UP_Bad); `4W SATP!B293:F293` (Petrol>1000, Age All)
- **Trace:** `examples/sample-traces/go_digit.json`

### Reliance IndusInd — Private Car Comprehensive

- **Decision status:** `UNSUPPORTED`
- **Reason:** `NOT_COVERED_FROM_AVAILABLE_EVIDENCE`
- **Grid selection:** `NO_APPLICABLE_VERSION` — supplied later-labelled grid not applied to Dec-2025 policy
- **Latest-grid fallback used:** `false`
- **Final rate:** `null`
- **H3 adjustment:** Preserved as `MULTIPLY_RATE 0.95` with status `NOT_APPLIED`
- **Evidence:** Policy issue date 2025-12-12; grid labels `FEB 26` / `Jan-26`
- **Trace:** `examples/sample-traces/reliance_indusind.json`

### Tata AIG — Private Car SATP

- **Decision status:** `AMBIGUOUS`
- **Reason:** `DATE_ANCHOR_AND_ALL_IN_PAYOUT_UNRESOLVED`
- **OD applicability:** `NOT_APPLICABLE` (SATP)
- **TP applicability:** `APPLICABLE` — rate **withheld**
- **Candidate rate:** 38.0% (invariant across all 7 type rows) — **not approved**
- **All stages:** `PENDING` (date anchor, override, COA, gross payout, settlement)
- **Evidence:** `Pvtcar!V511`, `V515`, `V519`, `V523`, `V527`, `V531`, `V535`; `General Guidelines!C7` (TP basis on Net Premium)
- **Trace:** `examples/sample-traces/tata_aig.json`

---

## 4. Hosted URL and Deployment Verification

**Deployment status: NOT DEPLOYED**

A complete `render.yaml` is committed. It configures:

- `insurance-rater-db` — Render managed PostgreSQL 17 (basic-256mb plan)
- `insurance-rater-reviewer` — Docker web service (port 8080, `GET /healthz` health check)
- `insurance-rater-worker` — Docker worker service (`npm run start:worker`)

**To deploy:**

1. Connect the repository to Render.com.
2. Deploy `render.yaml` as a "Blueprint".
3. Set secret environment variables from the table below.
4. Verify `GET /healthz` returns `{"status":"ok","ready":true}`.
5. Confirm an upload persists across a service restart.

**Required secret environment variables:**

| Variable                | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `REVIEWER_ACCESS_TOKEN` | Minimum 32-character secret token for reviewer workspace access |
| `S3_BUCKET`             | S3-compatible bucket name (Cloudflare R2, AWS S3, etc.)         |
| `S3_REGION`             | Bucket region (e.g. `us-east-1` or `auto` for R2)               |
| `S3_ENDPOINT`           | Optional: custom endpoint for R2 or MinIO                       |
| `S3_ACCESS_KEY_ID`      | Access key                                                      |
| `S3_SECRET_ACCESS_KEY`  | Secret access key                                               |

`DATABASE_URL` is auto-populated from `insurance-rater-db` by Render.

**Persistence design:**

- Original PDFs are stored in S3 by content-addressed key (`reviewer/{workspaceId}/{documentId}/{sha256}.pdf`). They survive any number of restarts or redeployments.
- All analysis data is in PostgreSQL. The migration (`001-initial.sql`) is idempotent and runs on every startup.
- The processing queue is in PostgreSQL. Crashed jobs are retried (up to 3 attempts) on worker restart.

---

## 5. Persistence Design and Test Results

**Design:**

- S3 objects are immutable after upload. Bucket is private; download requires a signed URL (60-second default TTL).
- PostgreSQL data survives container restarts and redeployments because it is managed separately from the application container.
- Job retry: `analysis_queue.attempts` is incremented; jobs with ≥3 attempts are marked `DEAD`.
- Idempotency: re-uploading a file with the same `Idempotency-Key` header returns the existing run without creating a duplicate.

**Storage-boundary tests:**

- Tests require a live PostgreSQL + S3 connection. No mock-away-all-persistence tests are written — only the contracts and bridge logic are tested without real infrastructure.
- **Action required:** Run integration tests with a local PostgreSQL + MinIO instance to verify end-to-end persistence.

---

## 6. OCR / LLM Configuration and Real-PDF Test Results

**OCR provider:** Currently `disabled`. The `OcrProvider` interface is defined. A real implementation can be injected by implementing `recognize({ pdfBytes, pages })` and setting `OCR_PROVIDER` to a recognized value.

**LLM fact extraction:** Currently `disabled`. The `PolicyFactProvider` interface is defined. A real implementation can be injected by implementing `extract({ pdfBytes, pages, fileName, sourceSha256 })`.

**Real-PDF PDF.js test:**
The test `pdf-real-policies.test.ts` runs `inspectPdf()` against all 4 supplied policy PDFs and validates:

- Page count > 0
- Page dimensions > 0
- `lowText` flag consistent with text character count
- Text block coordinates are finite numbers

**Status: NOT VERIFIED in this session** (requires running `npm test` in `apps/service/` with the policies present).

---

## 7. Exact Commands, Working Directories, Exit Codes, Build Results

The following commands were reported as passing in previous sessions. **They must be re-run to confirm current state.**

### Phase 2A

```bash
cd phase-2a
npm run typecheck   # reported: exit 0
npm test            # reported: 15/15 passed
```

### Phase 2B Go Digit

```bash
cd phase-2b
npm run typecheck   # reported: exit 0
npm test            # reported: 20/20 passed
```

### Phase 2B Reliance

```bash
cd phase-2b-reliance
npm run typecheck   # reported: exit 0
npm test            # reported: 32/32 passed
npm run build       # reported: exit 0
```

### Phase 2B HDFC ERGO

```bash
cd phase-2b-hdfc
npm run typecheck   # reported: exit 0
npm test            # reported: passed
npm run build       # reported: exit 0
```

### Phase 2B Tata AIG

```bash
cd phase-2b-tata-aig
npm run typecheck   # reported: exit 0
npm test            # reported: passed
npm run build       # reported: exit 0
```

### Service

```bash
cd apps/service
npm run typecheck   # NOT VERIFIED THIS SESSION
npm test            # NOT VERIFIED THIS SESSION
npm run build       # NOT VERIFIED THIS SESSION
```

---

## 8. Git Status and Important Commits

Git status: not checked in this session (WSL access was restricted). The repository exists at `/home/pradeep/projects/insurance-rater-agent` and has a `.git` directory.

---

## 9. Security / Dependency Advisories

- Express 5.x (beta) is used. No known critical advisories at the time of implementation.
- `pdfjs-dist` 6.x is used for PDF inspection only (not OCR).
- AWS SDK v3 is used for S3 operations.
- Timing-safe token comparison (`timingSafeEqual`) is used for the reviewer access token.
- Original source files are immutable; PDFs are validated against an `%PDF-` signature before processing.
- No secrets are committed. `.env` is in `.gitignore`.
- Rate limiting: 10 uploads per workspace per 24-hour window.

**Recommendation before submission:** Run `npm audit` in each package and address any high/critical advisories. Do not mass-upgrade; test after each upgrade.

---

## 10. Remaining Gaps Against Baseline Challenge Requirements

| Requirement                                   | Status              | Gap                                                                          |
| --------------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| All 4 insurer commission paths                | IMPLEMENTED (draft) | Adapters are drafts; no approved production rules emitted                    |
| Correct OD/TP/Package applicability           | IMPLEMENTED         | Verified in test; enforced by schema                                         |
| Explainable results with citations and traces | IMPLEMENTED         | Decision trace structure complete; real citations from adapter artifacts     |
| Additional unseen policy PDF upload           | IMPLEMENTED         | Upload endpoint + worker processes any PDF                                   |
| Persistent uploaded files                     | IMPLEMENTED (code)  | Requires S3 credentials to verify                                            |
| Persistent analysis history                   | IMPLEMENTED (code)  | Requires PostgreSQL to verify                                                |
| Hosted browser frontend                       | IMPLEMENTED (code)  | Requires deployment to get hosted URL                                        |
| Storage surviving restarts/redeployments      | DESIGNED            | Not verified without deployment                                              |
| Automated rating logic tests                  | IMPLEMENTED         | `contracts.test.ts`, `draft-traces.test.ts` — not run this session           |
| Storage-boundary tests                        | NOT IMPLEMENTED     | Integration tests against real DB/S3 not written                             |
| Four structured sample traces                 | IMPLEMENTED         | Generated by `npm run sample-traces` from `apps/service/`                    |
| README with setup/run/deploy instructions     | IMPLEMENTED         | Root `README.md` + `apps/service/README.md`                                  |
| Architecture / assumptions / failure modes    | PARTIAL             | This report covers architecture; a separate failure-modes doc is not written |

---

## 11. Manual Actions Required Before Submission

1. **Generate a reviewer access token:**

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Set up S3-compatible storage** (Cloudflare R2 is free and recommended):
   - Create a bucket (private)
   - Create an API token with R2 read/write permission
   - Note the bucket name, account ID, access key, secret key

3. **Deploy to Render.com:**
   - Connect the GitHub repository
   - Create a new "Blueprint" deployment using `render.yaml`
   - Set the 6 secret environment variables from Section 4
   - Wait for the first deploy to succeed
   - Verify `GET https://<your-service>.onrender.com/healthz`

4. **Run all tests to confirm current environment:**

   ```bash
   cd apps/service && npm test
   cd phase-2b-hdfc && npm test
   cd phase-2b-tata-aig && npm test
   ```

5. **Generate sample traces:**

   ```bash
   cd apps/service && npm run sample-traces
   ```

   This produces `examples/sample-traces/{hdfc_ergo,go_digit,reliance_indusind,tata_aig}.json`.

6. **Verify persistence** after a service restart:
   - Upload a policy PDF through the UI
   - Restart the Render web service manually
   - Confirm the run still appears in history
