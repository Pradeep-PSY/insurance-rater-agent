# Reliance IndusInd Private Car Adapter — Kickoff

This package contains the source-grounded adapter specification and the Codex implementation task.

## Files

- `RELIANCE-ADAPTER-SPEC.md` — insurer-specific source facts, mappings, rate-table conditions, date handling, unresolved terms, expected draft structure, and tests.
- `CODEX-RELIANCE-ADAPTER-TASK.md` — implementation instructions for the local repository.

## Important scope boundary

This adapter is for the supplied Reliance IndusInd private-car workbook. The supplied sample policy is a December 2025 policy, while the workbook/file labels are January/February 2026. The sample must therefore remain `UNSUPPORTED` for rate resolution from this corpus. Do not emit the workbook's candidate 22.5% / conditional 21.375% as the sample policy's commission.

The project-owner's 0.95 interpretation of the `<1000 CC` reduction is approved. Other payout terms (ZD, Extended Warranty, Tyre/RTI) must remain un-applied until their precise operation and eligibility/basis are evidenced.

## Existing project context

- Phase 2A reads the source documents and emits `GridDocumentIR` / inventory artifacts.
- Phase 2B Go Digit already provides an adapter implementation pattern.
- Phase 1 P0 contract defects are intentionally deferred by project instruction. Do not modify `phase-1/` or force this adapter into incomplete canonical contracts. Use an adapter-specific Zod-validated draft.
