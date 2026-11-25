CREATE TABLE IF NOT EXISTS reviewer_workspaces (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS policy_documents (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES reviewer_workspaces(id),
  original_filename text NOT NULL,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  sha256 char(64) NOT NULL,
  page_count integer NOT NULL CHECK (page_count > 0),
  page_inspection jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES reviewer_workspaces(id),
  document_id uuid NOT NULL REFERENCES policy_documents(id),
  idempotency_key text NOT NULL,
  processing_status text NOT NULL CHECK (processing_status IN ('UPLOADED','QUEUED','PROCESSING','COMPLETED','FAILED')),
  decision_status text CHECK (decision_status IN ('RESOLVED','UNSUPPORTED','AMBIGUOUS')),
  selected_ruleset_id text,
  extractor_version text,
  ocr_provider text,
  ocr_version text,
  parser_version text NOT NULL,
  result_json jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (workspace_id, idempotency_key),
  CHECK ((processing_status = 'COMPLETED' AND decision_status IS NOT NULL) OR processing_status <> 'COMPLETED')
);

CREATE TABLE IF NOT EXISTS extracted_facts (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  fact_status text NOT NULL CHECK (fact_status IN ('KNOWN','MISSING','INVALID','AMBIGUOUS','UNVERIFIED')),
  raw_value text,
  normalized_value text,
  provenance text NOT NULL CHECK (provenance IN ('POLICY_DOCUMENT','EXTERNAL_REFERENCE','OWNER_CLARIFICATION','DERIVED','SYSTEM')),
  confidence text NOT NULL CHECK (confidence IN ('HIGH','MEDIUM','LOW','NOT_ASSESSED')),
  evidence_json jsonb NOT NULL,
  confidence_reason text NOT NULL,
  UNIQUE (run_id, field_name)
);

CREATE TABLE IF NOT EXISTS rate_components (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  component text NOT NULL CHECK (component IN ('OD','TP','PACKAGE')),
  applicability text NOT NULL CHECK (applicability IN ('APPLICABLE','NOT_APPLICABLE','NOT_SEPARATELY_SPECIFIED','UNRESOLVED')),
  rate_status text NOT NULL CHECK (rate_status IN ('RESOLVED','UNSUPPORTED','AMBIGUOUS','WITHHELD','NOT_APPLICABLE','NOT_SEPARATELY_SPECIFIED')),
  rate_percent numeric,
  premium_basis text,
  evidence_json jsonb NOT NULL,
  UNIQUE (run_id, component)
);

CREATE TABLE IF NOT EXISTS grid_selections (
  run_id uuid PRIMARY KEY REFERENCES analysis_runs(id) ON DELETE CASCADE,
  insurer text,
  date_anchor_kind text NOT NULL,
  resolved_anchor_date date,
  selected_bundle_id text,
  selected_bundle_version text,
  source_file text,
  source_sha256 char(64),
  effective_from date,
  effective_to date,
  coverage_status text NOT NULL,
  reason_code text NOT NULL,
  reason text NOT NULL,
  date_anchor_evidence_json jsonb NOT NULL,
  selection_evidence_json jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_matches (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('MATCHED','DECLINED','EXCLUDED','OVERRIDDEN','MISSING_DATA','NOT_APPLICABLE')),
  conditions_json jsonb NOT NULL,
  priority_json jsonb NOT NULL,
  evidence_json jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_adjustments (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  rule_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('MULTIPLY_RATE','ADD_PERCENTAGE_POINTS','ADD_FIXED_AMOUNT')),
  operand numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('APPLIED','NOT_APPLIED','UNRESOLVED')),
  reason text NOT NULL,
  evidence_json jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS uninterpreted_metrics (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  raw_value text,
  evidence_json jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS payout_stage_records (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  stage_index integer NOT NULL,
  status text NOT NULL,
  formula text NOT NULL,
  premium_basis text,
  inputs_json jsonb NOT NULL,
  output_inr numeric,
  reason text NOT NULL,
  evidence_json jsonb NOT NULL,
  UNIQUE (run_id, stage_name, stage_index)
);

CREATE TABLE IF NOT EXISTS decision_trace_steps (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  stage text NOT NULL,
  status text NOT NULL CHECK (status IN ('COMPLETED','SKIPPED','BLOCKED','WARNING')),
  summary text NOT NULL,
  evidence_json jsonb NOT NULL,
  UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS confidence_reasons (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('HIGH','MEDIUM','LOW','NOT_ASSESSED')),
  reason text NOT NULL
);

CREATE TABLE IF NOT EXISTS unresolved_issues (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  reason_code text NOT NULL,
  description text NOT NULL,
  blocking boolean NOT NULL,
  evidence_json jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS processing_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  processing_status text NOT NULL,
  event_code text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ruleset_versions (
  id text PRIMARY KEY,
  insurer text NOT NULL,
  version text NOT NULL,
  source_manifest_sha256 char(64) NOT NULL,
  approval_status text NOT NULL CHECK (approval_status IN ('DRAFT','APPROVED','RETIRED')),
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurer, version)
);

CREATE TABLE IF NOT EXISTS analysis_queue (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE REFERENCES analysis_runs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('QUEUED','PROCESSING','DONE','DEAD')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upload_rate_limits (
  workspace_id text NOT NULL REFERENCES reviewer_workspaces(id),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0),
  PRIMARY KEY (workspace_id, window_start)
);

CREATE INDEX IF NOT EXISTS analysis_runs_workspace_created_idx
  ON analysis_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_queue_claim_idx
  ON analysis_queue (status, available_at, created_at);
CREATE INDEX IF NOT EXISTS processing_events_run_created_idx
  ON processing_events (run_id, created_at);
