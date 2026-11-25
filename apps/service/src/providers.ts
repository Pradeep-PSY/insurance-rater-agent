import type { PdfInspection } from "./pdf.js";
import type { FactRecord } from "./contracts.js";

export const minimumAcceptedOcrConfidence = 0.8;

export interface OcrProvider {
  readonly providerId: string;
  readonly version: string | null;
  recognize(input: { pdfBytes: Buffer; pages: number[] }): Promise<{
    pages: Array<{
      pageNumber: number;
      text: string;
      confidence: number | null;
      geometry: {
        x: number; y: number; width: number; height: number; pageWidth: number; pageHeight: number;
      } | null;
      textBlocks: Array<{
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }>;
  }>;
}

export interface PolicyFactProvider {
  readonly providerId: string;
  readonly version: string | null;
  extract(input: {
    pageEvidence: Array<{
      pageNumber: number;
      text: string;
      source: "PDF_TEXT" | "OCR";
      providerId: string | null;
      version: string | null;
      confidence: number | null;
      textBlocks: Array<{ text: string; x: number; y: number; width: number; height: number }>;
      pageWidth: number;
      pageHeight: number;
    }>;
  }): Promise<FactRecord[]>;
}

export interface PolicyPageEvidence {
  pageNumber: number;
  text: string;
  source: "PDF_TEXT" | "OCR";
  providerId: string | null;
  version: string | null;
  confidence: number | null;
  textBlocks: Array<{ text: string; x: number; y: number; width: number; height: number }>;
  pageWidth: number;
  pageHeight: number;
}

export interface PolicyExtractionResult {
  facts: FactRecord[];
  ocrStatus: "NOT_REQUIRED" | "NOT_CONFIGURED" | "PROVIDED";
  extractionStatus: "NOT_CONFIGURED" | "PROVIDED";
  extractorVersion: string | null;
  ocrProvider: { providerId: string; version: string | null };
  reason: string;
}

export class DisabledOcrProvider implements OcrProvider {
  readonly providerId = "disabled";
  readonly version = null;
  async recognize(): Promise<never> {
    throw new Error("OCR_PROVIDER_NOT_CONFIGURED");
  }
}

export class DisabledPolicyFactProvider implements PolicyFactProvider {
  readonly providerId = "disabled";
  readonly version = null;
  async extract(): Promise<never> {
    throw new Error("POLICY_FACT_PROVIDER_NOT_CONFIGURED");
  }
}

export async function extractPolicyFacts(input: {
  pdfBytes: Buffer;
  inspection: PdfInspection;
  ocrProvider: OcrProvider;
  factProvider: PolicyFactProvider;
  fileName: string;
  sourceSha256: string;
}): Promise<PolicyExtractionResult> {
  const needsOcr = input.inspection.lowTextPageNumbers.length > 0;
  const pageEvidence: PolicyPageEvidence[] = input.inspection.pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text,
    source: "PDF_TEXT" as const,
    providerId: null,
    version: "pdfjs-dist/6",
    confidence: null,
    textBlocks: page.textBlocks,
    pageWidth: page.pageWidth,
    pageHeight: page.pageHeight,
  }));
  let ocrStatus: PolicyExtractionResult["ocrStatus"] = needsOcr ? "NOT_CONFIGURED" : "NOT_REQUIRED";
  if (needsOcr && input.ocrProvider.providerId !== "disabled") {
    const recognized = await input.ocrProvider.recognize({
      pdfBytes: input.pdfBytes,
      pages: input.inspection.lowTextPageNumbers,
    });
    const requestedPages = new Set(input.inspection.lowTextPageNumbers);
    const receivedPages = new Set<number>();
    for (const page of recognized.pages) {
      if (!requestedPages.has(page.pageNumber) || receivedPages.has(page.pageNumber)) {
        throw new Error("OCR_PAGE_REFERENCE_INVALID");
      }
      if (!Number.isFinite(page.confidence) && page.confidence !== null) {
        throw new Error("OCR_CONFIDENCE_INVALID");
      }
      if (page.confidence !== null && (page.confidence < 0 || page.confidence > 1)) {
        throw new Error("OCR_CONFIDENCE_INVALID");
      }
      receivedPages.add(page.pageNumber);
      const base = input.inspection.pages.find((candidate) => candidate.pageNumber === page.pageNumber);
      if (!base) throw new Error("OCR_PAGE_REFERENCE_INVALID");
      pageEvidence[page.pageNumber - 1] = {
        pageNumber: page.pageNumber,
        text: page.text,
        source: "OCR",
        providerId: input.ocrProvider.providerId,
        version: input.ocrProvider.version,
        confidence: page.confidence,
        textBlocks: page.textBlocks,
        pageWidth: page.geometry?.pageWidth ?? base.pageWidth,
        pageHeight: page.geometry?.pageHeight ?? base.pageHeight,
      };
    }
    if (receivedPages.size !== requestedPages.size) throw new Error("OCR_PAGE_COVERAGE_INCOMPLETE");
    ocrStatus = "PROVIDED";
  }
  const unavailableFacts: FactRecord[] = [
    "insurer",
    "policyType",
    "issueDate",
    "loginDate",
    "registrationNumber",
    "rto",
    "make",
    "model",
    "fuel",
    "engineCapacityCc",
    "bodyType",
    "previousInsurer",
    "odNetPremium",
    "tpLiabilityNetPremium",
    "gst",
  ].map((field) => ({
    field,
    status: "MISSING",
    rawValue: null,
    normalizedValue: null,
    provenance: "SYSTEM",
    confidence: "NOT_ASSESSED",
    evidence: [],
    confidenceReason: "No structured policy fact extraction provider is configured.",
  }));
  if (input.factProvider.providerId === "disabled") {
    return {
      facts: unavailableFacts,
      ocrStatus,
      extractionStatus: "NOT_CONFIGURED",
      extractorVersion: null,
      ocrProvider: {
        providerId: input.ocrProvider.providerId,
        version: input.ocrProvider.version,
      },
      reason: needsOcr && ocrStatus === "NOT_CONFIGURED"
        ? "PDF pages contain little extractable text and OCR is not configured; structured policy fact extraction is also not configured."
        : "Structured policy extraction is not configured; no facts are asserted.",
    };
  }
  const extractedFacts = await input.factProvider.extract({ pageEvidence });
  const facts = validateFactEvidence({
    facts: extractedFacts,
    pages: pageEvidence,
    fileName: input.fileName,
    sourceSha256: input.sourceSha256,
  });
  return {
    facts,
    ocrStatus,
    extractionStatus: "PROVIDED",
    extractorVersion: `${input.factProvider.providerId}${input.factProvider.version ? `@${input.factProvider.version}` : ""}`,
    ocrProvider: {
      providerId: input.ocrProvider.providerId,
      version: input.ocrProvider.version,
    },
    reason: ocrStatus === "NOT_CONFIGURED"
      ? "Structured fact extraction has no OCR text for one or more low-text scanned pages."
      : "Structured extraction completed; each policy quote was checked against extracted page text and source hash.",
  };
}

export function validateFactEvidence(input: {
  facts: FactRecord[];
  pages: Pick<PolicyPageEvidence,
    "pageNumber" | "text" | "source" | "providerId" | "version" | "confidence" |
    "textBlocks" | "pageWidth" | "pageHeight">[];
  fileName: string;
  sourceSha256: string;
}): FactRecord[] {
  return input.facts.map((fact) => {
    let rejected = false;
    const evidence = fact.evidence.map((item) => {
      if (item.sourceKind !== "POLICY_PDF") return item;
      const page = item.pageNumber === null
        ? undefined
        : input.pages.find((candidate) => candidate.pageNumber === item.pageNumber);
      const geometry = item.geometry;
      const geometryVerified = geometry === null || (page !== undefined &&
        geometry.pageWidth === page.pageWidth &&
        geometry.pageHeight === page.pageHeight &&
        geometry.x >= 0 &&
        geometry.y >= 0 &&
        geometry.x + geometry.width <= page.pageWidth &&
        geometry.y + geometry.height <= page.pageHeight &&
        page.textBlocks.some((block) => {
          const blockText = block.text.replace(/\s+/g, " ").trim().toLowerCase();
          const quoteText = (item.quote ?? "").replace(/\s+/g, " ").trim().toLowerCase();
          const overlaps = geometry.x <= block.x + block.width &&
            geometry.x + geometry.width >= block.x &&
            geometry.y <= block.y + block.height &&
            geometry.y + geometry.height >= block.y;
          return blockText.length > 0 &&
            (quoteText.includes(blockText) || blockText.includes(quoteText)) &&
            overlaps;
        }));
      const verified = item.fileName === input.fileName &&
        item.sourceSha256 === input.sourceSha256 &&
        page !== undefined &&
        ((page.source === "PDF_TEXT" && item.extraction.method === "PDF_TEXT" &&
          item.extraction.providerId === null) ||
         (page.source === "OCR" && item.extraction.method === "OCR" &&
          item.extraction.providerId === page.providerId &&
          item.extraction.version === page.version)) &&
        item.quote !== null &&
        item.quote.trim().length > 0 &&
        page.text.includes(item.quote) &&
        geometryVerified;
      if (!verified) rejected = true;
      return {
        ...item,
        validation: verified ? "VERIFIED" as const : "REJECTED" as const,
        ocrConfidence: page?.source === "OCR" ? page.confidence : null,
      };
    });
    const lowConfidenceOcr = evidence.some((item) =>
      item.extraction.method === "OCR" &&
      (item.ocrConfidence === null || item.ocrConfidence < minimumAcceptedOcrConfidence),
    );
    if (rejected || (fact.status === "KNOWN" &&
        fact.provenance === "POLICY_DOCUMENT" &&
        !evidence.some((item) => item.sourceKind === "POLICY_PDF" && item.validation === "VERIFIED"))) {
      return {
        ...fact,
        status: "INVALID" as const,
        rawValue: fact.rawValue ?? fact.normalizedValue,
        normalizedValue: null,
        confidence: "LOW" as const,
        evidence,
        confidenceReason: "Extracted fact did not have a verifiable quote, page, source filename, and source hash.",
      };
    }
    if (lowConfidenceOcr && fact.status === "KNOWN") {
      return {
        ...fact,
        status: "UNVERIFIED" as const,
        normalizedValue: null,
        confidence: "LOW" as const,
        evidence,
        confidenceReason: `OCR evidence confidence is below the engineering review threshold (${minimumAcceptedOcrConfidence}); the extracted value is not eligible for matching.`,
      };
    }
    return { ...fact, evidence };
  });
}
