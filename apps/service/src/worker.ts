import { createHash } from "node:crypto";
import { createPool, migrate } from "./db.js";
import { loadConfig } from "./config.js";
import { pdfInspectionSchema } from "./pdf.js";
import { createPrivateObjectStore } from "./object-store.js";
import { DisabledOcrProvider, DisabledPolicyFactProvider, extractPolicyFacts } from "./providers.js";
import { resolveUnconfiguredPolicy } from "./resolver.js";
import { claimNextJob, retryOrFailJob } from "./queue.js";
import type { ClaimedJob } from "./queue.js";

const parserVersion = "pdfjs-dist/5";

async function completeJob(
  pool: ReturnType<typeof createPool>,
  job: ClaimedJob,
  result: ReturnType<typeof resolveUnconfiguredPolicy>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of [
      "extracted_facts",
      "rate_components",
      "grid_selections",
      "rule_matches",
      "rate_adjustments",
      "uninterpreted_metrics",
      "payout_stage_records",
      "decision_trace_steps",
      "confidence_reasons",
      "unresolved_issues",
    ]) {
      await client.query(`DELETE FROM ${table} WHERE run_id = $1`, [job.runId]);
    }
    for (const fact of result.facts) {
      await client.query(
        `INSERT INTO extracted_facts
           (run_id, field_name, fact_status, raw_value, normalized_value, provenance, confidence, evidence_json, confidence_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [job.runId, fact.field, fact.status, fact.rawValue, fact.normalizedValue, fact.provenance, fact.confidence, JSON.stringify(fact.evidence), fact.confidenceReason],
      );
    }
    for (const component of result.components) {
      await client.query(
        `INSERT INTO rate_components
           (run_id, component, applicability, rate_status, rate_percent, premium_basis, evidence_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [job.runId, component.component, component.applicability, component.status, component.ratePercent, component.premiumBasis, JSON.stringify(component.evidence)],
      );
    }
    const selection = result.gridSelection;
    await client.query(
      `INSERT INTO grid_selections
         (run_id, insurer, date_anchor_kind, resolved_anchor_date,
          selected_bundle_id, selected_bundle_version, source_file, source_sha256,
          effective_from, effective_to, coverage_status, reason_code, reason,
          date_anchor_evidence_json, selection_evidence_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb)`,
      [
        job.runId,
        selection.insurer,
        selection.dateAnchorKind,
        selection.resolvedAnchorDate,
        selection.selectedBundle?.id ?? null,
        selection.selectedBundle?.version ?? null,
        selection.selectedBundle?.sourceFile ?? null,
        selection.selectedBundle?.sourceSha256 ?? null,
        selection.effectivePeriod?.from ?? null,
        selection.effectivePeriod?.to ?? null,
        selection.coverageStatus,
        selection.reasonCode,
        selection.reason,
        JSON.stringify(selection.dateAnchorEvidence),
        JSON.stringify(selection.selectionEvidence),
      ],
    );
    for (const match of result.ruleMatches) {
      await client.query(
        `INSERT INTO rule_matches
           (run_id, rule_id, outcome, conditions_json, priority_json, evidence_json)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,
        [
          job.runId,
          match.ruleId,
          match.outcome,
          JSON.stringify({ matched: match.matchedConditions, missing: match.missingConditions }),
          JSON.stringify(match.priorityDimensions),
          JSON.stringify(match.evidence),
        ],
      );
    }
    for (const adjustment of result.rateAdjustments) {
      await client.query(
        `INSERT INTO rate_adjustments
           (run_id, rule_id, operation, operand, status, reason, evidence_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [job.runId, adjustment.ruleId, adjustment.operation, adjustment.operand, adjustment.status, adjustment.reason, JSON.stringify(adjustment.evidence)],
      );
    }
    for (const metric of result.uninterpretedMetrics) {
      await client.query(
        `INSERT INTO uninterpreted_metrics (run_id, field_name, raw_value, evidence_json)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [job.runId, metric.fieldName, metric.rawValue, JSON.stringify(metric.evidence)],
      );
    }
    const stages = [
      ["baseCommission", result.payoutStages.baseCommission],
      ["incrementalCoa", result.payoutStages.incrementalCoa],
      ["grossPayout", result.payoutStages.grossPayout],
      ...result.payoutStages.settlementAdjustments.map((stage, index) => [`settlementAdjustment:${index + 1}`, stage] as const),
      ["netPayable", result.payoutStages.netPayable],
    ] as const;
    for (const [index, [stageName, stage]] of stages.entries()) {
      await client.query(
        `INSERT INTO payout_stage_records
           (run_id, stage_name, stage_index, status, formula, premium_basis,
            inputs_json, output_inr, reason, evidence_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb)`,
        [
          job.runId,
          stageName,
          index,
          stage.status,
          stage.formula,
          stage.premiumBasis,
          JSON.stringify(stage.inputs),
          stage.outputInr,
          stage.reason,
          JSON.stringify(stage.evidence),
        ],
      );
    }
    for (const step of result.trace) {
      await client.query(
        `INSERT INTO decision_trace_steps (run_id, sequence, stage, status, summary, evidence_json)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [job.runId, step.sequence, step.stage, step.status, step.summary, JSON.stringify(step.evidence)],
      );
    }
    for (const reason of result.confidence.reasons) {
      await client.query(
        `INSERT INTO confidence_reasons (run_id, level, reason) VALUES ($1,$2,$3)`,
        [job.runId, result.confidence.level, reason],
      );
    }
    for (const issue of result.unresolvedIssues) {
      await client.query(
        `INSERT INTO unresolved_issues (run_id, reason_code, description, blocking, evidence_json)
         VALUES ($1,$2,$3,$4,$5::jsonb)`,
        [job.runId, issue.code, issue.description, issue.blocking, JSON.stringify(issue.evidence)],
      );
    }
    await client.query(
      `UPDATE analysis_runs
       SET processing_status = 'COMPLETED', decision_status = $2, selected_ruleset_id = $3,
           extractor_version = $4, ocr_provider = $5, ocr_version = $6,
           result_json = $7::jsonb, failure_code = NULL,
           updated_at = now(), completed_at = now()
       WHERE id = $1`,
      [
        job.runId,
        result.decisionStatus,
        result.selectedRuleset.id,
        result.versions.extractor,
        result.versions.ocr.providerId,
        result.versions.ocr.version,
        JSON.stringify(result),
      ],
    );
    await client.query(
      `UPDATE analysis_queue SET status = 'DONE', locked_at = NULL, updated_at = now() WHERE run_id = $1`,
      [job.runId],
    );
    await client.query(
      `INSERT INTO processing_events (run_id, processing_status, event_code, message)
       VALUES ($1, 'COMPLETED', 'ANALYSIS_COMPLETED', 'Analysis completed; decision status is stored separately.')`,
      [job.runId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function processJob(
  pool: ReturnType<typeof createPool>,
  store: ReturnType<typeof createPrivateObjectStore>,
  job: ClaimedJob,
  config: ReturnType<typeof loadConfig>,
): Promise<void> {
  const bytes = await store.get(job.objectKey);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== job.sha256 || bytes.byteLength !== job.byteSize) {
    throw new Error("STORED_OBJECT_INTEGRITY_MISMATCH");
  }
  const inspection = pdfInspectionSchema.parse(job.pageInspection);
  if (inspection.pageCount !== job.pageCount) throw new Error("PDF_PAGE_COUNT_CHANGED");
  const extraction = await extractPolicyFacts({
    pdfBytes: bytes,
    inspection,
    ocrProvider: new DisabledOcrProvider(),
    factProvider: new DisabledPolicyFactProvider(),
    fileName: job.originalFilename,
    sourceSha256: job.sha256,
  });
  const result = resolveUnconfiguredPolicy({
    runId: job.runId,
    documentId: job.documentId,
    fileName: job.originalFilename,
    facts: extraction.facts,
    parserVersion,
    extractorVersion: extraction.extractorVersion,
    extractionReason: extraction.reason,
    lowTextPages: inspection.lowTextPageNumbers,
    ocr: {
      ...extraction.ocrProvider,
      status: extraction.ocrStatus,
    },
  });
  await completeJob(pool, job, result);
  if (process.env.NODE_ENV !== "test") {
    console.info(JSON.stringify({ event: "analysis-completed", runId: job.runId, status: result.decisionStatus }));
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = createPool(config);
  const store = createPrivateObjectStore(config);
  await migrate(pool, config.WORKSPACE_ID);
  console.info("Persistent analysis worker started.");
  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });
  while (!stopping) {
    const job = await claimNextJob(pool);
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      continue;
    }
    try {
      await processJob(pool, store, job, config);
    } catch (error) {
      const knownCodes = [
        "OBJECT_BODY_MISSING",
        "STORED_OBJECT_INTEGRITY_MISMATCH",
        "PDF_PAGE_COUNT_CHANGED",
        "INVALID_PDF_SIGNATURE",
        "PDF_PAGE_LIMIT_EXCEEDED",
        "OCR_PROVIDER_NOT_CONFIGURED",
        "POLICY_FACT_PROVIDER_NOT_CONFIGURED",
        "OCR_PAGE_REFERENCE_INVALID",
        "OCR_CONFIDENCE_INVALID",
        "OCR_PAGE_COVERAGE_INCOMPLETE",
      ];
      const errorCode = error instanceof Error && knownCodes.includes(error.message)
        ? error.message
        : "PROCESSING_ERROR";
      await retryOrFailJob(pool, job, errorCode);
      console.error(JSON.stringify({ event: "analysis-retry", runId: job.runId, errorCode }));
    }
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "WORKER_START_FAILED");
  process.exitCode = 1;
});
