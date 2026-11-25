# Submission Draft

## What is implemented

The agent accepts motor policy PDFs and returns a deterministic, evidence-backed commission analysis for the following four insurers:

| Insurer           | Policy type               | Outcome                                  | Key source                                                   |
| ----------------- | ------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| HDFC ERGO         | Private Car Comprehensive | AMBIGUOUS (fuel unresolved)              | `Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf`          |
| Go Digit          | Private Car SATP          | AMBIGUOUS (Max CD2 semantics unresolved) | `Large Insurance Brokers Mar'26 - Shared.xlsx`               |
| Reliance IndusInd | Private Car Comprehensive | UNSUPPORTED (no contemporaneous grid)    | `Pvt Car Feb26 Revised Grid.xlsx`                            |
| Tata AIG          | Private Car SATP          | AMBIGUOUS (date anchor and COA pending)  | `Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx` |

Where a commission rate cannot be determined correctly from the evidence, the system explicitly returns `UNSUPPORTED` or `AMBIGUOUS` with a full decision trace. No rates are invented.

## Four sample decision traces

The traces for the four supplied policies are accessible:

1. **HDFC ERGO:** [PLACEHOLDER — link to trace in UI or repository, e.g. examples/sample-traces/hdfc_ergo.json]
2. **Go Digit:** [PLACEHOLDER — examples/sample-traces/go_digit.json]
3. **Reliance IndusInd:** [PLACEHOLDER — examples/sample-traces/reliance_indusind.json]
4. **Tata AIG:** [PLACEHOLDER — examples/sample-traces/tata_aig.json]

## Technical highlights

- **Deterministic rating engine:** No LLM involvement in commission selection. All rate lookups, mapping matches, and exclusion evaluations are deterministic TypeScript.
- **Durable persistence:** Uploaded PDFs are stored in private S3-compatible object storage. All analysis data persists in PostgreSQL across browser refreshes, service restarts, and redeployments.
- **Full evidence chain:** Every extracted fact, mapping match, rate candidate, and trace step includes exact source citations (PDF page/item index, Excel sheet/cell).
- **Correct unsupported/ambiguous handling:** Four distinct states — `KNOWN`, `MISSING`, `INVALID`, `AMBIGUOUS` — for facts; `RESOLVED`, `UNSUPPORTED`, `AMBIGUOUS` for decisions.
- **Privacy:** Uploaded policy files are kept in a private bucket. The reviewer workspace is protected by a bearer token.

## Setup and deployment

Please see `README.md` and `apps/service/README.md` for local development setup and `render.yaml` for the deployment configuration.

## Known limitations

- OCR and structured LLM fact extraction are behind clean provider interfaces but are currently running in disabled stub mode. Uploaded policies will return `UNSUPPORTED` until a real extraction provider is configured.
- Adapter drafts have not been promoted to approved production rule bundles; this requires a formal review step.
- Storage-boundary integration tests (verifying persistence across restarts with a real database) are not yet automated.

Thank you for the opportunity to work on this challenge.
