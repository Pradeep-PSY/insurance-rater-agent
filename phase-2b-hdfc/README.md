# HDFC ERGO Phase 2B Adapter

This isolated package reconstructs the supplied HDFC ERGO private-car grid from
the **actual Phase 2A `GridDocumentIR` inventory**. It does not open or parse the
original PDF, change Phase 2A, or emit approved commission rules.

## Run

From `phase-2b-hdfc`:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run normalize -- ../phase-2a/artifacts/phase-2a-real-corpus/phase-2a-inventory.json ./artifacts/hdfc-ergo
```

The normalizer writes `hdfc-ergo-adapter-draft.json` and
`HDFC-ERGO-ADAPTER-REPORT.md` to the requested output directory. It selects only
the manifest-verified HDFC PDF IR, checks the source hash/size against the
Phase 2A manifest verification, and rejects missing pages, source identity
mismatches, or incomplete geometric reconstruction.

## Reconstruction and provenance

- Both pages and every Phase 2A text item are retained with the original item
  index, exact text, page, and bounding box (including blank/space items).
- Rate-table rows are reconstructed by baseline and x-coordinate grouping:
  Zone 1/2 × Package/SAOD, five slabs per table, and three header-resolved cells
  per slab.
- The geography table on each page preserves directly printed state/region
  labels and source-cited inherited context for grouped rows.
- Slab labels are retained verbatim; endpoint inclusivity is not normalized or
  used as executable range logic.
- The printed effective date is extracted from its exact page-1 text item.
  Phase 2A's `effectiveFrom`/status remain separately recorded as unknown.
- PDF source citations are Phase 2A page/text-item locators, not fabricated
  spreadsheet-style cell or row numbers.

Phase 2A supplies coordinates and text but not vector borders, fills, or native
table objects. This adapter can deterministically group the inspected rows and
columns, but it does not claim that those reconstructed table boundaries were
present as native PDF metadata.

## Decision boundaries

- `Package` and `SAOD` remain distinct product categories. `Package` is a
  package-scope rate; `SAOD` is an OD-component product.
- The grid's lookup basis is Comprehensive + SAOD GWP, excluding SATP premium.
- Separately, the project-owner clarification says a Package Rate applies once
  to total net package premium (OD + TP/liability), excluding GST. The
  clarification is not attributed to the insurer PDF.
- Package-rate OD and TP component rates are `NOT_SEPARATELY_SPECIFIED`, not
  zero and not separate percentages.
- The HDFC sample fuel is missing from policy evidence. Diesel is only external,
  unapproved corroboration. The sample trace therefore has `AMBIGUOUS` status,
  a null final rate/payout, and conditional candidates only.
- No approved commission rules are emitted.

Source bundle files and other phase packages are not modified by this adapter.
