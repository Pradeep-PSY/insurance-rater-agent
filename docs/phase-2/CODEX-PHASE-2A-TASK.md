# Codex Task – Phase 2A: Read-only Source Reader POC

You are implementing Phase 2A of the Insurance Rater Agent.

## Before starting
Read:
- `AGENTS.md`
- `docs/phase-0/README.md`
- All four insurer rulebooks under `docs/phase-0/`
- `docs/phase-2/PHASE-2-GRID-INGESTION-BLUEPRINT.md`
- Current Phase 1 contracts and the second read-only audit report.

The source corpus must be located from the existing repository. Do not assume a path; inspect the repository first.

## Scope
Implement ONLY the raw source reader / inventory layer.

Do not:
- implement rating logic;
- decide commission meanings;
- generate final `CommissionRule` objects;
- create insurer-specific commission calculations;
- modify source XLSX/PDF files;
- modify Phase 0 rulebooks;
- fix Phase 1 contracts in this task;
- use sample-policy filenames to select any rate.

## Required implementation

1. Source manifest verifier:
   - Parse MANIFEST.json.
   - Verify each listed source file's byte length and SHA-256.
   - Return structured pass/fail records.
   - Never skip mismatches.

2. XLSX source reader:
   - Prefer ExcelJS for read-only inspection of original XLSX files.
   - First prove that it opens all three original workbooks.
   - Inventory all sheets, including hidden and empty sheets.
   - Preserve sheet name, order, visibility, dimensions, merged ranges.
   - Preserve non-empty cells with address, raw value, formula, cached result, error, number format and style ID where available.
   - Do not recalculate formulas.
   - Do not write back to source workbooks.
   - If a workbook fails to load, report exact error and isolate that workbook; do not silently omit it. Investigate a read-only OOXML fallback only after documenting the primary parser failure.

3. PDF grid reader:
   - Use PDF.js (`pdfjs-dist`) or the project's approved PDF reader.
   - Read only the HDFC ERGO commission-grid PDF in Phase 2A.
   - Preserve page number, page dimensions, text strings and text coordinates.
   - Do not yet infer commission meaning from the text.
   - The HDFC grid is a text-based two-page PDF; OCR is not required for this source.

4. Raw IR:
   - Create a typed `GridDocumentIR` that preserves source-file identity and original locators.
   - Keep raw source representation separate from normalized rules.
   - Use Zod validation.
   - Preserve unresolved date labels, formula errors and parser warnings.

5. Inventory report:
   - Produce machine-readable JSON and a readable Markdown inventory.
   - Include all sheet inventories and HDFC PDF page inventories.
   - Include parser name/version, source hash, parser warnings, and file-level success/failure.
   - Do not print entire 100k-cell pivot/check sheets to the terminal. Store detailed inventory as an artifact and provide compact summaries.

6. Tests:
   - Manifest hash matches and mismatch.
   - All XLSX workbooks are opened or return explicit parser error.
   - Hidden sheets are included.
   - Empty sheets are included.
   - Merged ranges are preserved.
   - Formula and cached value remain separate.
   - Formula error cells remain errors, not zero.
   - PDF pages and text coordinates are preserved.
   - No rule/commission rate is emitted by Phase 2A.

## Notes from source inspection
- Go Digit `4W  RTO` columns C/D/E are product-specific cluster mappings; SATP must use `4WTP` column C.
- Go Digit `4W SATP` has `Max CD2` as a raw, unresolved metric.
- Reliance workbook has merged regions and two different period labels: workbook label February 2026 and private-car sheet title Jan-26.
- Tata AIG has hidden `cv checks` and `pci checks` sheets, formula cells, source errors, and a `pci checks` pivot cache sourced only from `Pvtcar!G5:BO131`, while `Pvtcar` currently extends to row 568.
- HDFC grid PDF has two pages and extractable text. Preserve text positions for later table reconstruction.
- The exact source locators are documented in the Phase 2 blueprint.

## Acceptance
At completion:
- Run typecheck and tests.
- Report exact commands, working directory, exit codes and test count.
- Show changed/added files.
- Provide compact inventory results.
- Provide a ZIP of the Phase 2A package if practical.
- Do not claim success for any file the parser did not actually open.
- Do not proceed to Phase 2B automatically. Wait for project lead review and approval.
