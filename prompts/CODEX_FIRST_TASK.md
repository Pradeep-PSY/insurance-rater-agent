# First Codex task — inspect Phase 1 contracts (read-only)

Read `AGENTS.md` first, then read all four insurer rulebooks in `docs/phase-0/` and the consolidated `phase-0-final-report.md`.

Inspect the current repository, package manager, existing source files, and the drafted Phase 1 contract package if it is present. Do not make edits in this first pass.

## Your assignment

Review whether the current canonical contracts can accurately represent all four supplied policy examples and their insurer-specific rule paths.

Pay special attention to:

1. `PolicyFacts`: field-level states for known, missing, invalid, ambiguous, and externally corroborated values; raw vs normalized values; page-level evidence; issue date vs cover start date; current vs previous insurer; premium breakup.
2. `EvidenceReference`: policy PDF page, OCR provenance, XLSX sheet/cell/range, PDF grid page/table, owner clarification, and external reference.
3. Rate scope and premium basis: OD-only, TP-only, Package; total net package premium excluding GST; OD premium; TP Net Premium; slab-selection basis distinct from payout basis.
4. Unknown/unapproved raw fields: Go Digit `Max CD2` must be preserved without being represented as TP commission.
5. Rule/version selection: issue-date/login-date anchor, effective-from/effective-to, no newest-grid fallback, and unsupported when no applicable version exists.
6. Adjustments: Reliance relative multiplier `0.95`; Tata AIG incremental COA only when eligible and selected base rule is not all-inclusive; settlement adjustment ledger separate from base commission.
7. Applicability semantics: SATP OD `not_applicable`; HDFC Package component rates `not_separately_specified` rather than `not_applicable`.
8. Decision output: `resolved`, `unsupported`, `ambiguous`; separate processing status; confidence tied to evidence.

## Expected output

Return a review report with:

- Current repository/package structure.
- Files inspected.
- Contract-by-contract assessment.
- A matrix showing whether each of the four insurers can be represented without losing any source facts or business distinctions.
- Missing fields/types/union cases and concrete examples.
- Critical schema changes (P0), useful improvements (P1), and optional improvements (P2).
- Suggested tests for each identified gap.
- Exact commands that you ran and their real results.

Do not change code, install dependencies, run destructive commands, rename files, or create migrations in this task. Wait for approval after reporting findings.
