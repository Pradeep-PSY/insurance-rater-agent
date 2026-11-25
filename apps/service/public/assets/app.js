const accessForm = document.querySelector("#accessForm");
const tokenInput = document.querySelector("#accessToken");
const accessMessage = document.querySelector("#accessMessage");
const accessPanel = document.querySelector("#accessPanel");
const workspace = document.querySelector("#workspace");
const uploadForm = document.querySelector("#uploadForm");
const policyFile = document.querySelector("#policyFile");
const fileName = document.querySelector("#fileName");
const uploadButton = document.querySelector("#uploadButton");
const uploadMessage = document.querySelector("#uploadMessage");
const runsList = document.querySelector("#runsList");
const detailPanel = document.querySelector("#detailPanel");
const detailTitle = document.querySelector("#detailTitle");
const detailSubtitle = document.querySelector("#detailSubtitle");
const detailBadges = document.querySelector("#detailBadges");
const detailContent = document.querySelector("#detailContent");
const searchRuns = document.querySelector("#searchRuns");
let selectedRunId = null;
let refreshTimer = null;

const token = () => sessionStorage.getItem("reviewer-token") || "";

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function badge(text, kind) {
  return node("span", `badge badge-${kind}`, text);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(options.headers || {}),
    },
  });
  if (response.status === 401) {
    signOut();
    throw new Error("Access token was rejected.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
  return body;
}

function signIn(value) {
  sessionStorage.setItem("reviewer-token", value);
  accessPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  accessMessage.textContent = "Access verified.";
  loadRuns();
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadRuns(true), 5000);
}

function signOut() {
  sessionStorage.removeItem("reviewer-token");
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  workspace.classList.add("hidden");
  accessPanel.classList.remove("hidden");
  tokenInput.value = "";
  selectedRunId = null;
  runsList.replaceChildren(node("p", "muted empty-state", "Sign in to load analysis history."));
  detailPanel.classList.add("hidden");
}

async function loadRuns(silent = false) {
  if (!token()) return;
  try {
    const query = encodeURIComponent(searchRuns.value.trim());
    const data = await request(`/api/runs?q=${query}`);
    renderRuns(data.runs || []);
    if (selectedRunId) await loadRun(selectedRunId, true);
  } catch (error) {
    if (!silent) {
      runsList.replaceChildren(node("p", "muted empty-state", error.message));
    }
  }
}

function renderRuns(runs) {
  runsList.replaceChildren();
  if (!runs.length) {
    runsList.append(node("p", "muted empty-state", "No analyses yet. Upload a policy PDF to get started."));
    return;
  }
  for (const run of runs) {
    const row = node("div", "run-row");
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", `Open analysis for ${run.originalFilename}`);
    const identity = node("div");
    identity.append(
      node("div", "run-name", run.originalFilename),
      node("div", "run-meta", `${new Date(run.createdAt).toLocaleString()} · ${run.pageCount} pages · ${formatBytes(run.byteSize)}`),
    );
    const state = run.processingStatus.toLowerCase();
    row.append(identity, badge(run.decisionStatus || run.processingStatus, run.decisionStatus?.toLowerCase() || state));
    row.addEventListener("click", () => loadRun(run.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        loadRun(run.id);
      }
    });
    runsList.append(row);
  }
}

function renderRun(data) {
  detailPanel.classList.remove("hidden");
  detailTitle.textContent = data.originalFilename;
  detailSubtitle.textContent = `Run ${data.id} · SHA-256 ${data.sha256}`;
  detailBadges.replaceChildren(
    badge(data.processingStatus, data.processingStatus.toLowerCase()),
    ...(data.decisionStatus ? [badge(data.decisionStatus, data.decisionStatus.toLowerCase())] : []),
  );
  detailContent.replaceChildren();
  if (data.failureCode) {
    const failure = node("div", "result-banner");
    failure.append(node("strong", "", "Processing failed"), node("span", "", `Recorded error code: ${data.failureCode}`));
    detailContent.append(failure);
  }
  const link = node("a", "document-link", "Open original policy PDF");
  link.href = data.documentUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  detailContent.append(link);

  if (data.processingStatus !== "COMPLETED" || !data.result) {
    detailContent.append(node("p", "muted empty-state", "Analysis is still processing. Status updates are saved and this view refreshes automatically."));
    renderEvents(data.events || []);
    return;
  }
  const result = data.result;
  const banner = node("div", "result-banner");
  banner.append(
    node("strong", "", "No rate has been determined."),
    node("span", "", `Decision: ${result.decisionStatus}. Unsupported means the available verified facts or approved rules do not support a rate. This is not a zero-percent commission.`),
  );
  detailContent.append(banner);

  const components = node("div", "result-grid");
  for (const component of result.components) {
    const card = node("div", "component-card");
    card.append(
      node("div", "component-name", `${component.component} · ${component.applicability.replaceAll("_", " ")}`),
      node("span", "component-rate", component.status === "NOT_APPLICABLE" ? "Not applicable" : component.status === "NOT_SEPARATELY_SPECIFIED" ? "Not separately specified" : component.ratePercent ? `${component.ratePercent}%` : "Withheld"),
      node("div", "component-reason", component.reason),
    );
    if (component.candidateRatePercent) {
      card.append(node("div", "candidate-rate", `Source candidate: ${component.candidateRatePercent}% · not a resolved commission rate`));
    }
    components.append(card);
  }
  detailContent.append(components);

  const selection = result.gridSelection;
  const selectionText = `${selection.insurer || "Insurer unknown"} · ${selection.coverageStatus.replaceAll("_", " ")} · ${selection.reason}`;
  const selectionSection = node("section");
  selectionSection.append(node("h3", "section-title", "Grid version selection"), node("p", "muted small", selectionText));
  for (const evidence of selection.dateAnchorEvidence || []) {
    selectionSection.append(citation(evidence, data.documentUrl));
  }
  if (selection.selectedBundle) {
    selectionSection.append(node("p", "muted small", `${selection.selectedBundle.sourceFile} · ${selection.effectivePeriod?.from || "?"} to ${selection.effectivePeriod?.to || "open-ended"}`));
    for (const evidence of selection.selectionEvidence) selectionSection.append(citation(evidence, data.documentUrl));
  }
  detailContent.append(selectionSection);

  if (result.facts.length) {
    const section = node("section");
    section.append(node("h3", "section-title", "Policy facts and evidence"));
    const list = node("div", "facts-list");
    for (const fact of result.facts) {
      const item = node("div", "fact-item");
      item.append(
        node("div", "fact-top"),
      );
      const top = item.firstChild;
      top.append(node("span", "fact-name", fact.field), node("span", "fact-state", `${fact.status} · ${fact.confidence}`));
      item.append(node("p", "", fact.normalizedValue || fact.rawValue || "No verified value"));
      item.append(node("p", "muted small", `${fact.provenance.replaceAll("_", " ")} · ${fact.confidenceReason}`));
      for (const evidence of fact.evidence) {
        item.append(citation(evidence, data.documentUrl));
      }
      list.append(item);
    }
    section.append(list);
    detailContent.append(section);
  }

  if (result.ruleMatches.length) {
    const section = node("section");
    section.append(node("h3", "section-title", "Rule evaluations"));
    const list = node("div", "trace-list");
    for (const match of result.ruleMatches) {
      const item = node("div", "trace-step");
      item.append(
        node("div", "trace-name", `${match.ruleId} · ${match.outcome}`),
        node("p", "", `Matched: ${match.matchedConditions.join(", ") || "none recorded"} · Missing: ${match.missingConditions.join(", ") || "none"}`),
        node("p", "muted small", `Override hierarchy: ${match.priorityDimensions.overrideHierarchy || "not specified"} · Rule specificity: ${match.priorityDimensions.ruleSpecificity || "not specified"}`),
      );
      for (const evidence of match.evidence) item.append(citation(evidence, data.documentUrl));
      list.append(item);
    }
    section.append(list);
    detailContent.append(section);
  }

  if (result.rateAdjustments.length) {
    const section = node("section");
    section.append(node("h3", "section-title", "Rate adjustments"));
    const list = node("div", "trace-list");
    for (const adjustment of result.rateAdjustments) {
      const item = node("div", "trace-step");
      item.append(
        node("div", "trace-name", `${adjustment.ruleId} · ${adjustment.status}`),
        node("p", "", `${adjustment.operation} ${adjustment.operand} · ${adjustment.reason}`),
      );
      for (const evidence of adjustment.evidence) item.append(citation(evidence, data.documentUrl));
      list.append(item);
    }
    section.append(list);
    detailContent.append(section);
  }

  if (result.uninterpretedMetrics.length) {
    const section = node("section");
    section.append(node("h3", "section-title", "Raw source metrics · uninterpreted"));
    const list = node("div", "trace-list");
    for (const metric of result.uninterpretedMetrics) {
      const item = node("div", "trace-step");
      item.append(node("div", "trace-name", metric.fieldName), node("p", "", `Raw value: ${metric.rawValue ?? "not present"} · not an approved commission rate`));
      for (const evidence of metric.evidence) item.append(citation(evidence, data.documentUrl));
      list.append(item);
    }
    section.append(list);
    detailContent.append(section);
  }

  detailContent.append(renderStages(result.payoutStages, data.documentUrl));
  const confidence = node("section");
  confidence.append(node("h3", "section-title", `Confidence · ${result.confidence.level}`));
  for (const reason of result.confidence.reasons) confidence.append(node("p", "muted small", reason));
  detailContent.append(confidence);
  if (result.unresolvedIssues.length) {
    const section = node("section");
    section.append(node("h3", "section-title", "Unresolved issues"));
    const list = node("div", "issue-list");
    for (const issue of result.unresolvedIssues) {
      const item = node("div", "issue-item");
      item.append(node("strong", "", `${issue.code}${issue.blocking ? " · blocking" : ""}`), node("p", "", issue.description));
      list.append(item);
    }
    section.append(list);
    detailContent.append(section);
  }
  const versions = node("section");
  versions.append(node("h3", "section-title", "Processing versions"));
  versions.append(node("p", "muted small", `PDF parser: ${result.versions.parser} · Fact extractor: ${result.versions.extractor || "not configured"} · OCR: ${result.versions.ocr.providerId}${result.versions.ocr.version ? `@${result.versions.ocr.version}` : ""} (${result.versions.ocr.status}) · Resolver: ${result.versions.resolver}`));
  detailContent.append(versions);
  const trace = node("section");
  trace.append(node("h3", "section-title", "Decision trace"));
  const traceList = node("div", "trace-list");
  for (const step of result.trace) {
    const item = node("div", "trace-step");
    const top = node("div", "trace-top");
    top.append(node("span", "trace-name", `${String(step.sequence).padStart(2, "0")} · ${step.stage.replaceAll("_", " ")}`), node("span", "trace-state", step.status));
    item.append(top, node("p", "", step.summary));
    for (const evidence of step.evidence) {
      item.append(citation(evidence, data.documentUrl));
    }
    traceList.append(item);
  }
  trace.append(traceList);
  detailContent.append(trace);
  renderEvents(data.events || []);
}

function renderStages(stages, documentUrl) {
  const section = node("section");
  section.append(node("h3", "section-title", "Payout stages"));
  const grid = node("div", "stage-grid");
  const named = [
    ["Base commission", stages.baseCommission],
    ["Incremental COA", stages.incrementalCoa],
    ["Gross payout", stages.grossPayout],
    ["Net payable", stages.netPayable],
  ];
  for (const [label, stage] of named) {
    const card = node("div", "stage-card");
    card.append(
      node("strong", "", label),
      node("span", "", `${stage.status.replaceAll("_", " ")} · ${stage.formula.replaceAll("_", " ")}`),
    );
    if (stage.outputInr !== null) card.append(node("span", "stage-output", `₹${stage.outputInr}`));
    card.append(node("span", "", stage.reason));
    for (const input of stage.inputs) {
      card.append(node("span", "stage-input", `${input.name}: ${input.value ?? "unavailable"}${input.unit === "INR" && input.value ? " INR" : input.unit === "PERCENT" && input.value ? "%" : ""}`));
      for (const evidence of input.evidence) card.append(citation(evidence, documentUrl));
    }
    for (const evidence of stage.evidence) card.append(citation(evidence, documentUrl));
    grid.append(card);
  }
  for (const [index, stage] of stages.settlementAdjustments.entries()) {
    const card = node("div", "stage-card");
    card.append(
      node("strong", "", `Settlement adjustment ${index + 1}`),
      node("span", "", `${stage.status.replaceAll("_", " ")} · ${stage.formula.replaceAll("_", " ")}`),
      node("span", "", stage.reason),
    );
    if (stage.outputInr !== null) card.append(node("span", "stage-output", `₹${stage.outputInr}`));
    for (const input of stage.inputs) {
      card.append(node("span", "stage-input", `${input.name}: ${input.value ?? "unavailable"}${input.unit === "INR" && input.value ? " INR" : input.unit === "PERCENT" && input.value ? "%" : ""}`));
      for (const evidence of input.evidence) card.append(citation(evidence, documentUrl));
    }
    for (const evidence of stage.evidence) card.append(citation(evidence, documentUrl));
    grid.append(card);
  }
  section.append(grid);
  return section;
}

function citation(evidence, documentUrl) {
  const suffix = [
    evidence.pageNumber ? `page ${evidence.pageNumber}` : null,
    evidence.sheetName ? `${evidence.sheetName}${evidence.cellRange ? ` ${evidence.cellRange}` : ""}` : null,
    evidence.validation === "REJECTED" ? "quote not validated" : null,
  ].filter(Boolean).join(" · ");
  const label = `${evidence.fileName}${suffix ? ` · ${suffix}` : ""}`;
  if (evidence.sourceKind === "POLICY_PDF" && evidence.pageNumber && documentUrl && evidence.validation !== "REJECTED") {
    const link = node("a", "citation-link", label);
    link.href = `${documentUrl}#page=${evidence.pageNumber}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (evidence.quote) link.title = evidence.quote;
    return link;
  }
  const cite = node("p", "muted small", label);
  if (evidence.quote) cite.append(node("span", "evidence-quote", ` “${evidence.quote}”`));
  return cite;
}

function renderEvents(events) {
  if (!events.length) return;
  const section = node("section");
  section.append(node("h3", "section-title", "Processing history"));
  const list = node("div", "trace-list");
  for (const event of events) {
    const item = node("div", "trace-step");
    item.append(node("div", "trace-name", `${event.status} · ${event.code}`), node("p", "", event.message));
    list.append(item);
  }
  section.append(list);
  detailContent.append(section);
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadRun(id, silent = false) {
  try {
    selectedRunId = id;
    const data = await request(`/api/runs/${encodeURIComponent(id)}`);
    renderRun(data);
  } catch (error) {
    if (!silent) {
      detailPanel.classList.remove("hidden");
      detailContent.replaceChildren(node("p", "muted empty-state", error.message));
    }
  }
}

accessForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accessMessage.textContent = "Checking access…";
  sessionStorage.setItem("reviewer-token", tokenInput.value);
  try {
    await request("/api/runs");
    signIn(tokenInput.value);
  } catch (error) {
    sessionStorage.removeItem("reviewer-token");
    accessMessage.textContent = error.message;
  }
});

document.querySelector("#signOut").addEventListener("click", signOut);
document.querySelector("#refreshRuns").addEventListener("click", () => loadRuns());
searchRuns.addEventListener("input", () => loadRuns(true));
policyFile.addEventListener("change", () => {
  fileName.textContent = policyFile.files[0]?.name || "or drop it here";
});

document.querySelector("#dropZone").addEventListener("dragover", (event) => {
  event.preventDefault();
  event.currentTarget.classList.add("dragging");
});
document.querySelector("#dropZone").addEventListener("dragleave", (event) => {
  event.currentTarget.classList.remove("dragging");
});
document.querySelector("#dropZone").addEventListener("drop", (event) => {
  event.preventDefault();
  event.currentTarget.classList.remove("dragging");
  const file = event.dataTransfer.files[0];
  if (file) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    policyFile.files = transfer.files;
    fileName.textContent = file.name;
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = policyFile.files[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) {
    uploadMessage.textContent = "This file exceeds the 25 MB browser limit.";
    return;
  }
  uploadButton.disabled = true;
  uploadMessage.textContent = "Validating and securely storing your PDF…";
  try {
    const data = await request("/api/uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/pdf",
        "Idempotency-Key": crypto.randomUUID(),
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    });
    uploadMessage.textContent = `Upload accepted. Analysis ${data.runId} is ${data.processingStatus.toLowerCase()}.`;
    uploadForm.reset();
    fileName.textContent = "or drop it here";
    await loadRuns();
    await loadRun(data.runId);
  } catch (error) {
    uploadMessage.textContent = error.message;
  } finally {
    uploadButton.disabled = false;
  }
});

if (token()) {
  signIn(token());
}
