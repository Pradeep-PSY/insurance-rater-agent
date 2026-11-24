# Phase 2A – Raw Source Reader POC

This package implements only the raw source inventory layer. It does not
normalize commission rules or emit insurer-specific commission rates.

## Scripts

```bash
npm run typecheck
npm test
npm run inventory -- <source-root> <output-directory>
```

The inventory command reads `MANIFEST.json` at the source root and records
manifest hash/byte-length failures instead of skipping mismatched sources.

## Expected source directory

```text
<source-root>/
├── MANIFEST.json
├── README.md
├── challenge.md
├── sample-policies/
│   └── *.pdf
└── raters/
    ├── hdfc-ergo/
    ├── godigit/
    ├── reliance-indusind/
    └── tata-aig/
```

`MANIFEST.json` is expected to use this format:

```json
{
  "formatVersion": 1,
  "contents": {},
  "files": [
    {
      "path": "raters/godigit/march-2026/grid.xlsx",
      "bytes": 468080,
      "sha256": "64-character-hexadecimal-value"
    }
  ]
}
```

`formatVersion`, `contents`, and each `files[]` entry are preserved for
inventory reporting. Entry paths must be relative and cannot escape the source
root. Byte counts must be positive integers, and SHA-256 values must contain
exactly 64 hexadecimal characters.

## Verification and parsing

Run the inventory from the package directory:

```bash
npm run inventory -- <source-root> <output-directory>
```

Example:

```bash
npm run inventory -- ../data/source-corpus ./artifacts/phase-2a-real-corpus
```

Every listed file first undergoes existence, byte-size, and SHA-256 verification.
Only integrity-pass files under `raters/` are sent to document readers:

- `.xlsx` and `.xlsm` files use ExcelJS.
- `.pdf` files use pdfjs-dist.

Files under `sample-policies/` are integrity-verified but are never parsed as
grid PDFs. `README.md`, `challenge.md`, unknown locations, and unsupported
extensions are reported as verification-only or unsupported; they are not
silently omitted. Integrity failures are never sent to a document reader.

## Source readers

- `src/xlsx-reader.ts` uses ExcelJS read-only workbook inspection.
- `src/pdf-reader.ts` uses pdfjs-dist text and coordinate extraction.
- `src/manifest.ts` verifies source hashes and byte lengths.
- `src/grid-document-ir.ts` defines the Zod-validated raw intermediate representation.
- `src/inventory.ts` produces JSON and Markdown inventories.
