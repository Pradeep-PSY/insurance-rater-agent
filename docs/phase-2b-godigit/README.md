# Phase 2B – Go Digit Adapter Kickoff

This package contains the approved implementation scope for the first insurer adapter.

- `GO-DIGIT-ADAPTER-SPEC.md`: Detailed business and technical adapter specification.
- `CODEX-PHASE-2B-GODIGIT-TASK.md`: Prompt/task for the local Codex implementation.

The adapter is limited to Go Digit Private Car SATP. It consumes Phase 2A `GridDocumentIR` and emits an adapter-specific draft. It must not interpret `Max CD2` as commission, must not convert `All_India_Decline` into 0%, and must not modify Phase 1 contracts or source files.
