import type pg from "pg";
import type { PdfInspection } from "./pdf.js";

export interface ClaimedJob {
  runId: string;
  documentId: string;
  objectKey: string;
  originalFilename: string;
  pageCount: number;
  sha256: string;
  byteSize: number;
  attempts: number;
  pageInspection: PdfInspection;
}

export async function claimNextJob(pool: pg.Pool, maxAttempts = 5): Promise<ClaimedJob | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exhausted = await client.query<{ run_id: string }>(
      `UPDATE analysis_queue
       SET status = 'DEAD', locked_at = NULL, last_error_code = 'WORKER_LEASE_EXPIRED',
           updated_at = now()
       WHERE status = 'PROCESSING' AND locked_at < now() - interval '5 minutes'
         AND attempts >= $1
       RETURNING run_id`,
      [maxAttempts],
    );
    for (const row of exhausted.rows) {
      await client.query(
        `UPDATE analysis_runs SET processing_status = 'FAILED',
           failure_code = 'WORKER_LEASE_EXPIRED', updated_at = now(), completed_at = now()
         WHERE id = $1`,
        [row.run_id],
      );
      await client.query(
        `INSERT INTO processing_events (run_id, processing_status, event_code, message)
         VALUES ($1, 'FAILED', 'RETRY_LIMIT_REACHED', 'Worker lease expired after the configured retry limit.')`,
        [row.run_id],
      );
    }
    const selected = await client.query<ClaimedJob>(
      `SELECT q.run_id AS "runId", d.id AS "documentId", d.object_key AS "objectKey",
              d.original_filename AS "originalFilename", d.page_count AS "pageCount",
              d.sha256, d.byte_size::integer AS "byteSize", q.attempts,
              d.page_inspection AS "pageInspection"
       FROM analysis_queue q
       JOIN analysis_runs r ON r.id = q.run_id
       JOIN policy_documents d ON d.id = r.document_id
       WHERE q.attempts < $1
         AND ((q.status = 'QUEUED' AND q.available_at <= now())
           OR (q.status = 'PROCESSING' AND q.locked_at < now() - interval '5 minutes'))
       ORDER BY q.available_at, q.created_at
       FOR UPDATE OF q SKIP LOCKED
       LIMIT 1`,
      [maxAttempts],
    );
    const job = selected.rows[0];
    if (!job) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `UPDATE analysis_queue
       SET status = 'PROCESSING', attempts = attempts + 1, locked_at = now(), updated_at = now()
       WHERE run_id = $1`,
      [job.runId],
    );
    await client.query(
      `UPDATE analysis_runs SET processing_status = 'PROCESSING', updated_at = now() WHERE id = $1`,
      [job.runId],
    );
    await client.query(
      `INSERT INTO processing_events (run_id, processing_status, event_code, message)
       VALUES ($1, 'PROCESSING', 'WORKER_CLAIMED', 'Worker claimed the persisted analysis job.')`,
      [job.runId],
    );
    await client.query("COMMIT");
    return { ...job, attempts: job.attempts + 1 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function retryOrFailJob(
  pool: pg.Pool,
  job: ClaimedJob,
  errorCode: string,
  maxAttempts = 5,
): Promise<void> {
  const exhausted = job.attempts >= maxAttempts;
  const delaySeconds = Math.min(300, 2 ** job.attempts * 5);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE analysis_queue
       SET status = $2, available_at = now() + ($3 * interval '1 second'),
           locked_at = NULL, last_error_code = $4, updated_at = now()
       WHERE run_id = $1`,
      [job.runId, exhausted ? "DEAD" : "QUEUED", delaySeconds, errorCode],
    );
    await client.query(
      `UPDATE analysis_runs
       SET processing_status = $2, failure_code = $3, updated_at = now(),
           completed_at = CASE WHEN $2 = 'FAILED' THEN now() ELSE NULL END
       WHERE id = $1`,
      [job.runId, exhausted ? "FAILED" : "QUEUED", exhausted ? errorCode : null],
    );
    await client.query(
      `INSERT INTO processing_events (run_id, processing_status, event_code, message)
       VALUES ($1, $2, $3, $4)`,
      [
        job.runId,
        exhausted ? "FAILED" : "QUEUED",
        exhausted ? "RETRY_LIMIT_REACHED" : "JOB_RETRY_SCHEDULED",
        exhausted ? "Processing failed after the configured retry limit." : "Processing failure was recorded; retry scheduled.",
      ],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
