import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import { createPool, migrate } from "./db.js";
import { loadConfig } from "./config.js";
import { inspectPdf } from "./pdf.js";
import { createPrivateObjectStore } from "./object-store.js";
import { analysisResultSchema } from "./contracts.js";

const parserVersion = "pdfjs-dist/5";
const config = loadConfig();
const pool = createPool(config);
const objectStore = createPrivateObjectStore(config);
const app = express();
const appState = { ready: false };

function authenticate(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(config.REVIEWER_ACCESS_TOKEN);
  const actual = Buffer.from(token);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  next();
}

function safeFilename(value: string | undefined): string {
  const name = path.basename((value ?? "policy.pdf").replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
  return name || "policy.pdf";
}

function idempotencyKey(value: string | undefined): string | null {
  if (!value || value.length < 8 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) return null;
  return value;
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; frame-src blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", ready: appState.ready });
  } catch {
    res.status(503).json({ status: "unavailable", ready: false });
  }
});

app.get("/", async (_req, res, next) => {
  try {
    const html = await readFile(path.resolve(process.cwd(), "public", "index.html"), "utf8");
    res.type("html").send(html);
  } catch (error) {
    next(error);
  }
});

app.use("/assets", express.static(path.resolve(process.cwd(), "public", "assets"), {
  dotfiles: "deny",
  fallthrough: false,
  immutable: true,
  maxAge: "1h",
  setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
}));

app.post(
  "/api/uploads",
  authenticate,
  async (_req, res, next) => {
    try {
      await pool.query(
        `DELETE FROM upload_rate_limits
         WHERE window_start < date_trunc('hour', now()) - interval '24 hours'`,
      );
      const window = await pool.query<{ request_count: number }>(
        `INSERT INTO upload_rate_limits (workspace_id, window_start, request_count)
         VALUES ($1, date_trunc('hour', now()), 1)
         ON CONFLICT (workspace_id, window_start)
         DO UPDATE SET request_count = upload_rate_limits.request_count + 1
         RETURNING request_count`,
        [config.WORKSPACE_ID],
      );
      if ((window.rows[0]?.request_count ?? 0) > 10) {
        res.status(429).json({ error: "UPLOAD_RATE_LIMITED" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  express.raw({ type: "application/pdf", limit: config.UPLOAD_MAX_BYTES }),
  async (req, res, next) => {
    const key = idempotencyKey(req.header("idempotency-key"));
    if (!key) {
      res.status(400).json({ error: "IDEMPOTENCY_KEY_REQUIRED" });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.byteLength === 0) {
      res.status(400).json({ error: "EMPTY_PDF" });
      return;
    }
    const bytes = req.body as Buffer;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    let inspection;
    try {
      inspection = await inspectPdf(bytes, config.PDF_MAX_PAGES);
    } catch (error) {
      const code = error instanceof Error &&
        ["INVALID_PDF_SIGNATURE", "PDF_PAGE_LIMIT_EXCEEDED"].includes(error.message)
        ? error.message
        : "INVALID_OR_UNREADABLE_PDF";
      res.status(400).json({ error: code });
      return;
    }

    const existing = await pool.query(
      `SELECT r.id AS "runId", r.document_id AS "documentId", r.processing_status AS "processingStatus",
              r.decision_status AS "decisionStatus"
       FROM analysis_runs r
       WHERE r.workspace_id = $1 AND r.idempotency_key = $2`,
      [config.WORKSPACE_ID, key],
    );
    if (existing.rowCount) {
      res.status(200).json({ ...existing.rows[0], duplicate: true });
      return;
    }

    const client = await pool.connect();
    const documentId = randomUUID();
    const runId = randomUUID();
    const objectKey = `reviewer/${config.WORKSPACE_ID}/${documentId}/${sha256}.pdf`;
    let headerFilename = req.header("x-file-name") ?? undefined;
    if (headerFilename) {
      try {
        headerFilename = decodeURIComponent(headerFilename);
      } catch {
        res.status(400).json({ error: "INVALID_FILENAME_ENCODING" });
        client.release();
        return;
      }
    }
    const filename = safeFilename(headerFilename);
    let objectWritten = false;
    try {
      await client.query("BEGIN");
      await objectStore.put(objectKey, bytes, sha256);
      objectWritten = true;
      await client.query(
        `INSERT INTO policy_documents
           (id, workspace_id, original_filename, object_key, mime_type, byte_size, sha256, page_count, page_inspection)
         VALUES ($1,$2,$3,$4,'application/pdf',$5,$6,$7,$8::jsonb)`,
        [documentId, config.WORKSPACE_ID, filename, objectKey, bytes.byteLength, sha256, inspection.pageCount, JSON.stringify(inspection)],
      );
      await client.query(
        `INSERT INTO analysis_runs
           (id, workspace_id, document_id, idempotency_key, processing_status, parser_version)
         VALUES ($1,$2,$3,$4,'QUEUED',$5)`,
        [runId, config.WORKSPACE_ID, documentId, key, parserVersion],
      );
      await client.query(
        `INSERT INTO analysis_queue (run_id, status) VALUES ($1,'QUEUED')`,
        [runId],
      );
      await client.query(
        `INSERT INTO processing_events (run_id, processing_status, event_code, message)
         VALUES ($1,'UPLOADED','PDF_VALIDATED','PDF signature and structure validated; original is stored privately.')`,
        [runId],
      );
      await client.query(
        `INSERT INTO processing_events (run_id, processing_status, event_code, message)
         VALUES ($1,'QUEUED','JOB_QUEUED','Analysis job was persisted for worker processing.')`,
        [runId],
      );
      await client.query("COMMIT");
      res.status(202).json({
        runId,
        documentId,
        processingStatus: "QUEUED",
        decisionStatus: null,
        pageCount: inspection.pageCount,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      if (objectWritten) {
        try {
          await objectStore.delete(objectKey);
        } catch {
          console.error(JSON.stringify({ event: "orphan-object-cleanup-failed", objectId: documentId }));
        }
      }
      next(error);
    } finally {
      client.release();
    }
  },
);

app.get("/api/runs", authenticate, async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
    const results = await pool.query(
      `SELECT r.id, d.original_filename AS "originalFilename", d.sha256, d.byte_size::integer AS "byteSize",
              d.page_count AS "pageCount", r.processing_status AS "processingStatus",
              r.decision_status AS "decisionStatus", r.created_at AS "createdAt", r.updated_at AS "updatedAt"
       FROM analysis_runs r
       JOIN policy_documents d ON d.id = r.document_id
       WHERE r.workspace_id = $1 AND ($2 = '' OR d.original_filename ILIKE '%' || $2 || '%')
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [config.WORKSPACE_ID, query],
    );
    res.json({ runs: results.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:id", authenticate, async (req, res, next) => {
  try {
    const result = await pool.query<{
      id: string;
      processingStatus: string;
      decisionStatus: string | null;
      result: unknown;
      failureCode: string | null;
      documentId: string;
      originalFilename: string;
      sha256: string;
      byteSize: number;
      pageCount: number;
      objectKey: string;
      createdAt: Date;
      updatedAt: Date;
      events: Array<{ status: string; code: string; message: string; createdAt: Date }>;
    }>(
      `SELECT r.id, r.processing_status AS "processingStatus", r.decision_status AS "decisionStatus",
              r.result_json AS result, r.failure_code AS "failureCode",
              d.id AS "documentId", d.original_filename AS "originalFilename", d.sha256,
              d.byte_size::integer AS "byteSize", d.page_count AS "pageCount",
              d.object_key AS "objectKey", r.created_at AS "createdAt", r.updated_at AS "updatedAt",
              COALESCE(json_agg(json_build_object(
                'status', e.processing_status, 'code', e.event_code, 'message', e.message, 'createdAt', e.created_at
              ) ORDER BY e.created_at) FILTER (WHERE e.id IS NOT NULL), '[]'::json) AS events
       FROM analysis_runs r
       JOIN policy_documents d ON d.id = r.document_id
       LEFT JOIN processing_events e ON e.run_id = r.id
       WHERE r.id = $1 AND r.workspace_id = $2
       GROUP BY r.id, d.id`,
      [req.params.id, config.WORKSPACE_ID],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "RUN_NOT_FOUND" });
      return;
    }
    const row = result.rows[0]!;
    const analysis = row.result ? analysisResultSchema.parse(row.result) : null;
    const { objectKey, ...publicRun } = row;
    res.json({
      ...publicRun,
      result: analysis,
      documentUrl: await objectStore.signedReadUrl(objectKey),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isRecord = typeof error === "object" && error !== null;
  const errorType = isRecord && "type" in error && typeof error.type === "string" ? error.type : null;
  const errorStatus = isRecord && "status" in error && typeof error.status === "number" ? error.status : null;
  if (errorType === "entity.too.large") {
    res.status(413).json({ error: "UPLOAD_TOO_LARGE" });
    return;
  }
  console.error(JSON.stringify({
    event: "request-error",
    code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
  }));
  res.status(errorStatus && errorStatus >= 400 && errorStatus < 500 ? errorStatus : 500)
    .json({ error: errorStatus ? "REQUEST_REJECTED" : "INTERNAL_ERROR" });
});

async function main(): Promise<void> {
  await migrate(pool, config.WORKSPACE_ID);
  const server = app.listen(config.PORT, () => {
    appState.ready = true;
    console.info(`Reviewer service listening on port ${config.PORT}.`);
  });
  const shutdown = () => {
    appState.ready = false;
    server.close(() => void pool.end());
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "API_START_FAILED");
  process.exitCode = 1;
});
