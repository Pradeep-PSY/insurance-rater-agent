# Phase 2 – Commission Grid Ingestion Pipeline

**Status:** Kickoff / source reconnaissance complete; implementation not yet started  
**Purpose:** Convert original insurer commission-grid documents into a traceable, validated, versioned representation without losing source meaning.

## 1. Phase 2 objective

Build an offline ingestion pipeline that can:

1. Register and checksum original grid files.
2. Read XLSX and PDF grid sources without modifying them.
3. Preserve original structure: workbook sheets, hidden state, merged ranges, row/column/cell addresses, formulas, cached values, number formats, PDF page/table locations.
4. Convert relevant insurer-specific structures into a canonical draft representation.
5. Preserve unresolved labels, exclusions, formula errors, date ambiguity and unsupported conditions rather than guessing.
6. Validate the draft and publish an immutable, versioned rule bundle only after review.

The runtime rating engine must consume the published bundle. It must not parse the original workbooks on every policy upload.

## 2. Important sequencing decision

The Phase 1 second audit still identifies P0 contract defects:
- no first-class per-policy `RuleMatchResult`;
- fact-state provenance is incomplete;
- payout stages lack formula/input/evidence structure;
- grid selection lacks anchor/effective-period cross-validation;
- incremental COA calculation invariants are incomplete.

Therefore, Phase 2 should be split:

- **Phase 2A (can start now):** source inventory, read-only parsers and a raw source intermediate representation (`GridDocumentIR`).
- **Phase 2B (after Phase 1 P0 fixes):** insurer adapters that transform the raw IR into final canonical mapping and commission-rule contracts.
- **Phase 2C:** linting, manual review, bundle compilation and golden tests.

Do not bind the raw parser directly to the current incomplete `CommissionRule` contract.

## 3. Actual source corpus inspected

The original starter ZIP contains 4 policy PDFs, 3 XLSX rate cards and 1 HDFC ERGO PDF rate card. Phase 2 is concerned with the four rate-card sources.

### 3.1 HDFC ERGO PDF

Source:
`raters/hdfc-ergo/feb-2025/Pvt Car New Grid Eff 1st Feb'25 (HDFC ergo) 1.pdf`

Observed:
- Two pages; text is extractable.
- Effective label: `Effective from 1st Feb'25`.
- Page 1 contains Zone 1 and Zone 2 rate tables plus geography mapping.
- Page 2 contains North and Central geography mapping.
- Rate matrix dimensions: Package / SAOD, Petrol / Non-Petrol, NCB / N-NCB, premium/GWP category.
- Footnotes:
  - slab basis is Comprehensive + SAOD GWP on Private Car; SATP premium is excluded from slab achievement;
  - Non-Petrol includes Diesel, CNG and LPG;
  - New Business is considered as NCB;
  - EV and Hybrid are considered in the Petrol grid.

**Critical modelling distinction:** project-owner clarification says a Package payout rate is applied to eligible total policy Net Premium (OD + TP), GST excluded. This is the **payout basis**. The PDF's slab-selection condition uses Comprehensive + SAOD GWP, excluding SATP. This is the **lookup/slab basis**. They must be separate fields.

**Prior candidate warning:** the earlier 17.5% candidate is not approved. The supplied HDFC sample maps to Haryana / Zone 2; the policy vehicle is a non-petrol model based on external corroboration, and the applicable row also depends on NCB bucket and the actual GWP slab. Do not hardcode 17.5%. Revalidate the HDFC sample lookup after extracting/validating every required input.

### 3.2 Go Digit XLSX

Source:
`raters/godigit/march-2026/Large Insurance Brokers Mar'26 - Shared.xlsx`

Workbook sheets (all visible):
- `CV Grid (excl. HCV)` – `B1:J822`, 27 merged ranges
- `HCV GRID` – `A1:AK630`, 380 merged ranges
- `TAXI Segments and Location wise` – `B1:J588`, 10 merged ranges
- `4W SATP` – `A1:F328`, 119 formulas
- `4W New Business 1+3` – `A1:I31`, 2 merged ranges
- `TW 1+1 & SATP` – `B2:F360`, 1 merged range
- `TW 1+5` – `A1:I1199`, 1 merged range
- `2W Grid 5+5` – `A1:L1199`, 1,197 formulas
- `TW SAOD with Flexi Options` – `A4:L140`, 1 merged range
- `School & Staff Bus ` – `A2:K69`, 50 merged ranges and 8 formulas
- `School & Staff Bus RTO` – `B1:L1887`, 2 merged ranges
- `CV RTO Mapping` – `A1:M1923`, 315 cached `#N/A` cells
- `2W RTO's` – `B1:E1590`
- `4W  RTO` – `B1:F1724`

Relevant 4W SATP structure:
- `4W  RTO!B2:F2`: `RTO Code`, `4WTP`, `4W Package`, `4WSAOD`, `PLR Cluster`.
- `4W SATP!B2:F2`: `Cluster`, `Segment`, `Age`, `Max CD2`, `Note`.
- Product-specific RTO cluster columns must be preserved. SATP uses the `4WTP` column, not a generic cluster field.
- Sample mapping: `4W  RTO!B1609:C1609`: `UP78 -> UP_Bad`.
- Sample candidate row: `4W SATP!B293:E293`: `UP_Bad + Petrol>1000 + All -> Max CD2 raw value 0.29499999999999998`; the cell displays as 29.5% due to its number format.
- `Max CD2` meaning is unresolved by the project owner. Preserve as a raw metric. Do not emit as a commission rate.
- `4W SATP` column A contains 119 formula-generated composite keys. Preserve formula and cached value separately; authoritative dimensions are the separate columns B:E.
- `All_India_Decline` appears in SATP rows 3–8 with numeric zero values. It is a decline label, not a 0% commission.
- 80 RTO rows map to `All_India_Decline` in the `4WTP` mapping column.
- The Note column includes row-specific decline statements, including “Few RTOs...” and CC/age-related exclusions. If exact RTOs are not identified in the source, mark the exception unresolved; do not invent the list.
- Some notes appear inconsistent with the row's broad segment. Preserve and flag them for manual review.
- `CV RTO Mapping` has 315 `#N/A` cached errors; this is not the 4W SATP path but should be preserved as source quality metadata.

### 3.3 Reliance IndusInd XLSX

Source:
`raters/reliance-indusind/feb-2026/Reliance Broking Premier FEB 26 Grid.xlsx`

Sheets:
- `FEB'26 - Grid` – `A1:AU76`, 35 merged ranges
- `TW SCOOTER GRID` – `A1:AA16`, 11 merged ranges
- `PRIVATE CAR COMP, SAOD & STP` – `A1:Q17`, 11 merged ranges
- `Short Term Taxi` – empty
- `Enabler, PO Guidelines & T&C` – `A3:J62`, 38 merged ranges
- `Contest` – empty
- `RTO List` – `A1:E1502`
- `Make Model wise segment` – `A1:C536`
- No formula cells were observed in the workbook.

Important source details:
- The workbook/file is labelled February 2026.
- The private-car sheet itself is titled `Pvt Car Old Business Grid- Jan-26`. Preserve both labels; do not silently infer exact validity bounds from a filename.
- The private-car grid has merged region headers and a separate T&C area in column H. The adapter must retain merged ranges and interpret region grouping without blind forward-fill.
- `RTO List!A1253:E1253`: `UP-16 | UP16 | Delhi | T20 | NORTH`.
- `Make Model wise segment!A397:C397`: `RENAULT | KWID | SMALL`.
- `PRIVATE CAR COMP, SAOD & STP!H2`: payout on OD Premium.
- `H3`: `<1000 CC` PO will be 5% lesser; owner clarified this is relative reduction, i.e. base rate × 0.95.
- `H4`: Standalone ZD policies: 2.5% reduced; exact operation should remain unresolved until defined.
- `H5`: Extended Warranty flat 20% payout.
- `H6`: sourced Tyre/RTI bundle: 2.5% additional payout.
- The supplied February/January 2026 grid is not temporally applicable to the December 2025 sample policy. No later-grid fallback is allowed.

### 3.4 Tata AIG XLSX

Source:
`raters/tata-aig/march-2026/Tata AIG Standard Grid_Communication_Mar'26_F_v2_0212.xlsx`

Sheets:
- `General Guidelines` – `B1:D20`
- `cv checks` – hidden, `A3:DM970`, 46,368 formulas
- `pci checks` – hidden, `A3:DM1018`, 45,792 formulas
- `Pvtcar` – `A1:BR568`, 620 formulas, 5 formula/error cells
- `CV` – `A1:BQ124`, 290 formulas
- `TW` – `A1:DQ29`, 91 formulas
- `Pvtcar_Extended Warranty` – `A1:BI170`, 5 formulas and 5 formula/error cells

Important source details:
- `Pvtcar!F1`: standard Private Car grid applicable from policies dated 1-Nov-2025.
- `Pvtcar!F2`: Package/SAOD percentage on OD Premium; SATP percentage on Net Premium.
- `Pvtcar!F3`: visible base COA and separate GWP-based incremental COA.
- `Pvtcar!G5:L5`: Type, Business Type, Fuel Type, Section Text, NCB, Add On.
- `Pvtcar!V5`: DELHI location column.
- `General Guidelines!C5`: base commission and separate GWP-based incremental COA.
- `General Guidelines!C7`: product-specific premium basis.
- `General Guidelines!C10`: use policy RTO; branch RTO fallback applies to Brand New when policy RTO is unavailable.
- `General Guidelines!C11:C16`: source sequence says Policy Specific -> Fleet code -> PAN specific -> Code specific -> Standard Grid.
- `General Guidelines!C17` has wording that does not fully align with the preceding sequence; preserve this source inconsistency.
- `General Guidelines!C19`: cancellation/endorsement treatment.
- Hidden `pci checks` pivot cache 2 has source `Pvtcar!G5:BO131` and recordCount 1008, while current `Pvtcar` sheet extends to row 568. This cached pivot source does not cover the full current base grid and must not be treated as current, complete proof of COA values.
- `Pvtcar!A3:E3` and `Pvtcar_Extended Warranty!A3:E3` contain formula/reference errors. Preserve them as source errors; do not let these unrelated cells silently corrupt parsing.
- For the sample's known dimensions `Renewal + CNG + SATP + NCB All + Add On All + Delhi`, seven Type rows (511, 515, 519, 523, 527, 531, 535) all show 0.38 in Delhi column V. The policy Type category itself is not mapped to the grid's Type enum. Preserve the seven candidate rows and identical results; do not claim Hatch Back maps to Compact.
- This supports the base rate only. Full payout still depends on GWP/COA and overrides.

## 4. Parser architecture

Use a two-layer design:

### Layer A – Raw source readers

1. `XlsxSourceReader`
   - Read workbooks in read-only mode.
   - Preserve workbook/sheet order, sheet visibility, dimensions, merged ranges.
   - Preserve cell address, raw value, formula text, cached formula result, error type, number format and style ID where available.
   - Do not recalculate formulas.
   - Do not discard hidden sheets.
   - Do not forward-fill merged cells globally.
   - Keep empty sheets in inventory.
2. `PdfGridSourceReader`
   - Record page count and page dimensions.
   - Extract text items with coordinates.
   - Reconstruct candidate rows/cells while preserving page and bounding-box provenance.
   - Keep table/header structure separate from flattened text.
   - HDFC source is text-based; OCR is not needed for this grid PDF.
3. `SourceManifestVerifier`
   - Verify byte count and SHA-256 against `MANIFEST.json`.
   - Record file-level source identity.
4. Readers must never modify original source files.

### Layer B – Insurer adapters

- `hdfcErgoPdfAdapter`
- `goDigitWorkbookAdapter`
- `relianceWorkbookAdapter`
- `tataAigWorkbookAdapter`

Adapters consume `GridDocumentIR` rather than reading files directly. They emit:
- normalized dimensions;
- mapping candidates;
- commission-rate candidates;
- premium/lookup basis;
- typed notes, exclusions and decline candidates;
- date metadata;
- source locators;
- validation warnings;
- unresolved semantic questions.

Do not merge the raw reader and insurer business logic into one parser.

## 5. Recommended `GridDocumentIR`

The raw IR must preserve source information before semantic normalization.

Suggested shape:

```ts
type GridDocumentIR = {
  source: {
    sourceId: string;
    insurerId: string;
    fileName: string;
    format: "XLSX" | "PDF";
    sha256: string;
    byteSize: number;
    sourcePeriodLabel?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    effectiveDateStatus:
      | "EXPLICIT"
      | "LABEL_ONLY"
      | "CONFLICTING"
      | "UNKNOWN";
  };

  workbook?: {
    sheets: Array<{
      name: string;
      visibility: "VISIBLE" | "HIDDEN" | "VERY_HIDDEN";
      dimension?: string;
      mergedRanges: string[];
      cells: Array<{
        address: string;
        rawValue: string | number | boolean | null;
        formula?: string;
        cachedValue?: string | number | boolean | null;
        errorCode?: string;
        numberFormat?: string;
        styleId?: number;
      }>;
    }>;
  };

  pdf?: {
    pages: Array<{
      pageNumber: number;
      width: number;
      height: number;
      textItems: Array<{
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }>;
  };

  warnings: Array<{
    code: string;
    severity: "INFO" | "WARNING" | "BLOCKER";
    locator?: string;
    message: string;
  }>;
};
```

This is a starting contract, not a final Zod schema. Avoid duplicating entire workbook data into normalized CommissionRule records. Store raw IR as a source artifact and normalized rules as derived artifacts linked to it.

## 6. Ingestion and publication flow

```text
Original source files
        |
        v
Manifest verification (size + SHA-256)
        |
        v
Format detection
   |             |
 XLSX           PDF
   |             |
   v             v
XlsxReader    PdfGridReader
   |             |
   +------v------+
          |
          v
     GridDocumentIR
          |
          v
  Insurer-specific adapter
          |
          v
  Canonical draft rules
          |
          v
  Validation / lint checks
          |
          v
   Manual review queue
          |
          v
   Approved immutable bundle
          |
          v
    Runtime rating engine
```

## 7. Required validation rules

### Source integrity
- Manifest byte size and hash match.
- Original file path and original file name retained.
- No source file modified.

### Workbook parsing
- All sheets inventoried, including hidden and empty sheets.
- Merged regions preserved.
- Formula and cached value retained separately.
- Formula errors become warnings/quarantined cells, not silently zero.
- Number formats retained so raw `0.295` and display `29.5%` remain distinct.
- Formula-generated composite keys are not the only retained source of dimensions.

### Semantic normalization
- Every normalized rule has at least one original source locator.
- Every mapping retains exact source range.
- Every rate retains exact source row/cell or PDF page/table row.
- No undefined metric is converted to commission.
- Decline/exclusion is not converted to a zero rate.
- Unresolved note scope remains unresolved.
- No grid date is inferred from filename alone without a documented policy.
- A later grid cannot be selected for an earlier policy without explicit retrospective evidence.
- Lookup basis and payout basis remain separate.

### Conflicts
- Conflicting duplicate rules -> manual review / ambiguous.
- Missing mapping -> unsupported unless the source defines a valid fallback.
- Overlapping ranges -> blocker until the source's precedence is understood.
- Stale pivot cache -> warning; it is not authoritative for current source rows.
- Source formula errors -> preserve and quarantine affected derived values.

## 8. Phase 2 milestones

### 2A – Raw source reader POC
- Add source manifest/hash verifier.
- Add XLSX read-only inspector using the chosen Node library.
- Add PDF text/position inspector for HDFC PDF.
- Generate inventory JSON and Markdown.
- Test all four source grid files.
- No canonical insurer rules yet.

### 2B – Canonical intermediate adapter layer
- Define/approve `GridDocumentIR`.
- Implement Go Digit, Reliance, Tata AIG and HDFC adapters.
- Preserve all unresolved fields and warnings.
- Emit draft normalized JSON with citations.

### 2C – Validation and publication
- Add rule linting and conflict detection.
- Add golden tests for observed source rows.
- Human review each insurer bundle.
- Generate immutable rule bundle with version, manifest hash, parser version, adapter version, approval state and effective-date metadata.

## 9. Phase 2 acceptance criteria

Phase 2 is complete only when:

1. All four source grid files pass manifest verification.
2. All workbook sheets/pages are inventoried.
3. Hidden sheets and merged ranges are retained.
4. Formula results/errors are preserved without being invented or recalculated.
5. Go Digit sample mapping and SATP raw-metric row are reproduced with exact locators.
6. Reliance RTO/model mappings and private-car table/notes are represented with exact locators.
7. Tata AIG base-grid, guideline, hidden-check-sheet provenance and stale-pivot warning are represented.
8. HDFC rate table and geography table are represented with PDF page/table/row locators.
9. Unresolved semantics remain marked unresolved.
10. No unsupported final commission rate is emitted.
11. Every normalized rule can be traced to the exact original file and location.
12. The published bundle is immutable and has a reproducible manifest hash.

## 10. Important open questions to preserve

- Go Digit `Max CD2` meaning.
- Go Digit “Few RTOs” note exact RTO identities and inconsistent note scope.
- HDFC exact slab boundaries at threshold values; preserve raw labels until boundary semantics are verified.
- HDFC sample's correct GWP slab and NCB bucket; the earlier 17.5% candidate is not approved.
- Reliance date/version labels: workbook filename is February 2026, while private-car sheet title says Jan-26.
- Reliance standalone ZD reduction operation; owner has not defined whether 2.5 means relative or percentage-point reduction.
- Tata AIG source precedence `C11:C16` versus the owner's separate high-level description; preserve both and do not silently reconcile.
- Tata AIG producer GWP and authoritative incremental COA slab data.
- Tata AIG pivot cache does not cover the full current Pvtcar source range.

## 11. Engineering constraints

- Keep raw source readers independent from insurer adapters.
- Read original workbooks read-only.
- Do not use LLM to invent or decide final numeric rate semantics.
- Do not hardcode sample answers.
- Do not treat formula cached value as freshly recalculated unless explicitly recalculated by an approved calculation engine.
- Do not silently drop hidden sheets, errors, empty sheets, merged cells or footnotes.
- Do not use sample-policy filenames to select rates.
- Do not publish the rule bundle until source and semantic validation passes.
