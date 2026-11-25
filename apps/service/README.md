# Reviewer service

This package contains the reviewer web UI, API, persistent PostgreSQL queue/worker, PDF structural inspector, and private S3-compatible object-store adapter.

## Current operating boundary

The upload/history workflow is implemented, but OCR, structured fact extraction, and approved production rule bundles are not configured. Each accepted policy is therefore stored and receives a persisted `COMPLETED` processing status with an `UNSUPPORTED` decision. The service does not emit commission rates or calculate payout. Do not describe the current service as a functioning production rater.

## Requirements and configuration

- Node.js 24+
- PostgreSQL 15+
- A private, durable S3-compatible bucket with server-side encryption enabled
- A shared reviewer token with at least 32 characters

Copy `.env.example` to `.env` and set values through a secret manager in hosted environments. Do not commit the populated file.

`DATABASE_URL` must be a PostgreSQL connection URL. For hosted PostgreSQL, use certificate-verified TLS settings (for example `sslmode=verify-full` where supported); do not use `sslmode=require` because it does not verify the server identity. The object bucket must be private. Configure S3 credentials with write/read/delete permission only for this service's bucket/prefix.

## Local execution

Run commands from `apps/service/`:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run start:api
npm run start:worker
```

Run the API and worker in separate terminals. The API serves the browser UI on `PORT` (default 8080); PostgreSQL and S3-compatible storage must be available first. The worker claims durable queue jobs using row locks, retries transient failures, and marks exhausted jobs `FAILED`. The worker and API both run idempotent initial schema creation.

## Storage and privacy

- PostgreSQL stores reviewer workspace, original-object key/checksum/size/page count, page text and geometry produced by PDF.js, field-level facts, results, components, rule matches, explicit adjustments, payout stages, citations, confidence reasons, issues, processing events, and queue state.
- The original PDF is stored in the configured private S3-compatible bucket. API responses expose only a short-lived signed read URL after reviewer-token authentication.
- A retry reuses persisted PDF text/page geometry and rechecks the object's SHA-256 and length before processing.
- PostgreSQL and bucket persistence across restarts/redeployments depends on the selected managed services and retention policies; this has not been live-tested in this environment.
- The current reviewer token maps to one shared workspace. It is not multi-user authentication or per-person authorization. Restrict its distribution and access to the hosting secrets.

## Deploy template

`render.yaml` defines a managed PostgreSQL database, API/UI service, and background worker. Deployment still requires a private S3-compatible bucket, server-side secrets, a Render account, and a reviewed cost/retention configuration. The project has not been deployed.

OCR and structured extraction provider interfaces are in `src/providers.ts`. Provider configuration currently accepts only `disabled`; no API keys or services are configured. Do not enable a provider without implementing quote/page/hash validation, running all four supplied policies, and verifying page evidence against OCR output.

The engineering OCR confidence threshold is `0.8` on a provider's normalized 0–1 score. Lower-confidence text remains preserved but a policy fact based on it is marked `UNVERIFIED` and excluded from rule matching; this is a conservative implementation threshold, not an insurer rule.
