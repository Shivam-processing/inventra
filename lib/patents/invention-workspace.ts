import type {
  WorkflowState,
  WorkflowStatus,
  WorkflowTarget,
} from "@/lib/patents/workflow-state";

export const WORKSPACE_SECTION_IDS = [
  "overview",
  "invention-details",
  "images",
  "analysis",
  "feature-review",
  "patent-search",
  "comparison-matrix",
  "overlap-report",
  "patent-draft",
  "export",
  "activity",
] as const;

export type WorkspaceSectionId = typeof WORKSPACE_SECTION_IDS[number];
export type WorkspaceGroupId = "setup" | "technical" | "prior-art" | "drafting" | "history";

export type WorkspaceSectionDefinition = {
  id: WorkspaceSectionId;
  label: string;
  shortDescription: string;
  group: WorkspaceGroupId;
};

export type WorkspaceSectionState = WorkspaceSectionDefinition & {
  status: WorkflowStatus;
  explanation: string;
  version: number | null;
  lockedMessage: string | null;
};

export const WORKSPACE_GROUP_LABELS: Record<WorkspaceGroupId, string> = {
  setup: "Invention setup",
  technical: "Technical review",
  "prior-art": "Prior-art review",
  drafting: "Drafting",
  history: "History",
};

export const WORKSPACE_SECTIONS: readonly WorkspaceSectionDefinition[] = [
  { id: "overview", label: "Overview", shortDescription: "Readiness, progress, and the recommended next action", group: "setup" },
  { id: "invention-details", label: "Invention details", shortDescription: "Stored technical description and disclosure information", group: "setup" },
  { id: "images", label: "Images", shortDescription: "Upload and manage invention photographs or sketches", group: "setup" },
  { id: "analysis", label: "Analysis and clarifications", shortDescription: "Review structured analysis and answer clarification questions", group: "technical" },
  { id: "feature-review", label: "Feature review", shortDescription: "Edit and approve the technical feature set", group: "technical" },
  { id: "patent-search", label: "Patent search", shortDescription: "Generate, filter, sort, and review prior-art results", group: "prior-art" },
  { id: "comparison-matrix", label: "Comparison matrix", shortDescription: "Compare approved features across selected patents", group: "prior-art" },
  { id: "overlap-report", label: "Overlap report", shortDescription: "Review deterministic feature-overlap results", group: "prior-art" },
  { id: "patent-draft", label: "Patent draft", shortDescription: "Generate, edit, save, and version the preliminary draft", group: "drafting" },
  { id: "export", label: "Export", shortDescription: "Download the current saved draft as DOCX or PDF", group: "drafting" },
  { id: "activity", label: "Activity timeline", shortDescription: "Review current and historical workflow activity", group: "history" },
] as const;

export const WORKSPACE_PANEL_SECTIONS: readonly WorkspaceSectionId[][] = [
  ["overview"],
  ["invention-details"],
  ["images"],
  ["analysis", "feature-review"],
  ["patent-search", "comparison-matrix"],
  ["overlap-report"],
  ["patent-draft", "export"],
  ["activity"],
] as const;

export function isWorkspaceSection(value: string | null | undefined): value is WorkspaceSectionId {
  return WORKSPACE_SECTION_IDS.includes(value as WorkspaceSectionId);
}

export function resolveWorkspaceSection(
  requested: string | null | undefined,
  recommended: WorkspaceSectionId,
): WorkspaceSectionId {
  if (requested === null || requested === undefined || requested === "") return recommended;
  return isWorkspaceSection(requested) ? requested : "overview";
}

export function workspaceSectionForTarget(target: WorkflowTarget, analysisStatus: string): WorkspaceSectionId {
  if (target === "details") return "invention-details";
  if (target === "features") {
    return analysisStatus === "NOT_STARTED" || analysisStatus === "PROCESSING" || analysisStatus === "FAILED"
      ? "analysis"
      : "feature-review";
  }
  if (target === "search") return "patent-search";
  if (target === "overlap") return "overlap-report";
  if (target === "draft" || target === "draft-save") return "patent-draft";
  if (target === "export") return "export";
  return "overview";
}

export function recommendedWorkspaceSection(state: WorkflowState, analysisStatus: string) {
  return workspaceSectionForTarget(state.recommendation.target, analysisStatus);
}

export function adjacentWorkspaceSection(section: WorkspaceSectionId, direction: -1 | 1) {
  const index = WORKSPACE_SECTION_IDS.indexOf(section);
  return WORKSPACE_SECTION_IDS[index + direction] ?? null;
}

export function workspaceSectionUrl(currentQuery: string, section: WorkspaceSectionId) {
  const params = new URLSearchParams(currentQuery);
  params.set("section", section);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function step(state: WorkflowState, id: "details" | "features" | "search" | "overlap" | "draft" | "export") {
  return state.steps.find((item) => item.id === id)!;
}

export function buildWorkspaceSectionStates({
  workflow,
  analysisStatus,
  imageCount,
  hasPatentResults,
}: {
  workflow: WorkflowState;
  analysisStatus: string;
  imageCount: number;
  hasPatentResults: boolean;
}): WorkspaceSectionState[] {
  const details = step(workflow, "details");
  const features = step(workflow, "features");
  const search = step(workflow, "search");
  const overlap = step(workflow, "overlap");
  const draft = step(workflow, "draft");
  const exportStep = step(workflow, "export");
  const analysis: Pick<WorkspaceSectionState, "status" | "explanation" | "version"> = analysisStatus === "PROCESSING"
    ? { status: "IN_PROGRESS", explanation: "The invention analysis is processing.", version: null }
    : analysisStatus === "FAILED"
      ? { status: "ERROR", explanation: "The invention analysis failed and can be retried.", version: null }
      : analysisStatus === "NOT_STARTED"
        ? { status: "ACTION_REQUIRED", explanation: "Start the invention analysis to create structured review data.", version: null }
        : { status: analysisStatus === "APPROVED" ? "COMPLETED" : "ACTION_REQUIRED", explanation: analysisStatus === "APPROVED" ? "The analysis is reviewed and its features are approved." : "Review the analysis and complete any useful clarifications.", version: features.version };
  const matrixStatus = search.status === "COMPLETED" && hasPatentResults ? "COMPLETED" : search.status === "COMPLETED" ? "ACTION_REQUIRED" : search.status;
  const matrixExplanation = search.status === "COMPLETED" && !hasPatentResults
    ? "The completed search contains no patent results to compare."
    : search.status === "COMPLETED"
      ? "The current search results are available for feature comparison."
      : search.explanation;

  const states: Record<WorkspaceSectionId, Pick<WorkspaceSectionState, "status" | "explanation" | "version">> = {
    overview: {
      status: workflow.completionPercentage === 100 ? "COMPLETED" : "ACTION_REQUIRED",
      explanation: workflow.completionPercentage === 100 ? "The current workflow is complete." : workflow.recommendation.explanation,
      version: features.version,
    },
    "invention-details": details,
    images: {
      status: imageCount > 0 ? "COMPLETED" : "NOT_STARTED",
      explanation: imageCount > 0 ? `${imageCount} invention image${imageCount === 1 ? " is" : "s are"} stored.` : "No invention images have been uploaded.",
      version: null,
    },
    analysis,
    "feature-review": features,
    "patent-search": search,
    "comparison-matrix": { status: matrixStatus, explanation: matrixExplanation, version: search.version },
    "overlap-report": overlap,
    "patent-draft": draft,
    export: exportStep,
    activity: { status: "COMPLETED", explanation: "Stored workflow activity is available for review.", version: null },
  };

  function sectionLockedMessage(id: WorkspaceSectionId) {
    if (id === "analysis" && details.status !== "COMPLETED") return "Complete the invention details before starting analysis.";
    if (id === "feature-review" && !["NEEDS_REVIEW", "APPROVED"].includes(analysisStatus)) return "Analyse the invention before reviewing and approving its feature list.";
    if (id === "patent-search" && features.status !== "COMPLETED") return "Approve the feature list before starting a patent search.";
    if (id === "comparison-matrix" && (search.status !== "COMPLETED" || !hasPatentResults)) return "Complete a patent search with results before building the comparison matrix.";
    if (id === "overlap-report" && search.status !== "COMPLETED") return "Complete a current patent search before generating an overlap report.";
    if (id === "patent-draft" && overlap.status !== "COMPLETED") return "Generate a current overlap report before creating a draft.";
    if (id === "export" && draft.status !== "COMPLETED") return "Generate and save a current patent draft before exporting.";
    return null;
  }

  return WORKSPACE_SECTIONS.map((definition) => {
    const state = states[definition.id];
    return {
      ...definition,
      status: state.status,
      explanation: state.explanation,
      version: state.version,
      lockedMessage: sectionLockedMessage(definition.id),
    };
  });
}

export function workspacePanelVisibility(active: WorkspaceSectionId) {
  return WORKSPACE_PANEL_SECTIONS.map((sections, index) => ({
    key: `workspace-panel-${index + 1}`,
    sections,
    hidden: !sections.includes(active),
  }));
}
