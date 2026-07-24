export const WORKFLOW_STEP_IDS = [
  "details",
  "features",
  "search",
  "overlap",
  "draft",
  "export",
] as const;

export type WorkflowStepId = typeof WORKFLOW_STEP_IDS[number];
export type WorkflowStatus = "NOT_STARTED" | "ACTION_REQUIRED" | "IN_PROGRESS" | "COMPLETED" | "OUTDATED" | "ERROR";
export type WorkflowTarget = WorkflowStepId | "draft-save";

type StoredWorkflowStatus = "PROCESSING" | "COMPLETED" | "FAILED" | string;

export type WorkflowSearchRecord = {
  id: string;
  status: StoredWorkflowStatus;
  featureSetVersion: number;
};

export type WorkflowOverlapRecord = {
  id: string;
  patentSearchId: string;
  status: StoredWorkflowStatus;
  featureSetVersion: number;
};

export type WorkflowDraftRecord = {
  id: string;
  patentSearchId: string;
  overlapReportId: string;
  status: StoredWorkflowStatus;
  featureSetVersion: number;
  sectionsComplete: boolean;
};

export type WorkflowStateInput = {
  detailsComplete: boolean;
  analysisStatus: string;
  hasFeatureCandidates: boolean;
  featuresApproved: boolean;
  approvedFeatureSetVersion: number;
  latestSearch: WorkflowSearchRecord | null;
  latestCurrentSearchId: string | null;
  latestOverlapReport: WorkflowOverlapRecord | null;
  latestCurrentOverlapReportId: string | null;
  latestDraft: WorkflowDraftRecord | null;
  hasUnsavedDraftChanges: boolean;
};

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  status: WorkflowStatus;
  explanation: string;
  version: number | null;
  target: WorkflowTarget;
};

export type WorkflowRecommendation = {
  title: string;
  explanation: string;
  buttonLabel: string;
  target: WorkflowTarget;
};

export type WorkflowState = {
  steps: WorkflowStep[];
  completedSteps: number;
  totalSteps: number;
  completionPercentage: number;
  recommendation: WorkflowRecommendation;
};

const labels: Record<WorkflowStepId, string> = {
  details: "Invention details",
  features: "Feature review and approval",
  search: "Patent search",
  overlap: "Overlap report",
  draft: "Patent draft",
  export: "Draft export",
};

function storedStatus(status: StoredWorkflowStatus, completedExplanation: string, actionExplanation: string): Pick<WorkflowStep, "status" | "explanation"> {
  if (status === "PROCESSING") return { status: "IN_PROGRESS", explanation: "This step is currently processing." };
  if (status === "FAILED") return { status: "ERROR", explanation: actionExplanation };
  if (status === "COMPLETED") return { status: "COMPLETED", explanation: completedExplanation };
  return { status: "ACTION_REQUIRED", explanation: actionExplanation };
}

function step(id: WorkflowStepId, state: Pick<WorkflowStep, "status" | "explanation">, version: number | null = null): WorkflowStep {
  return { id, label: labels[id], target: id, version, ...state };
}

function recommendationFor(input: WorkflowStateInput, steps: WorkflowStep[]): WorkflowRecommendation {
  const byId = Object.fromEntries(steps.map((item) => [item.id, item])) as Record<WorkflowStepId, WorkflowStep>;

  if (byId.details.status !== "COMPLETED") {
    return { title: "Complete invention details", explanation: "Add the required invention information before continuing.", buttonLabel: "Go to invention details", target: "details" };
  }
  if (byId.features.status !== "COMPLETED") {
    if (byId.features.status === "IN_PROGRESS") return { title: "Analysis in progress", explanation: "Review will become available when the current analysis finishes.", buttonLabel: "View analysis status", target: "features" };
    if (byId.features.status === "ERROR") return { title: "Retry invention analysis", explanation: "The saved analysis failed and needs another attempt.", buttonLabel: "Go to AI analysis", target: "features" };
    if (input.analysisStatus === "NEEDS_REVIEW" || input.hasFeatureCandidates) return { title: "Review and approve the feature list", explanation: "Confirm the technical features that will drive every downstream record.", buttonLabel: "Review features", target: "features" };
    return { title: "Analyse the invention", explanation: "Generate the structured review and initial feature list.", buttonLabel: "Go to AI analysis", target: "features" };
  }
  if (byId.search.status !== "COMPLETED") {
    const retry = byId.search.status === "ERROR";
    return { title: retry ? "Retry the patent search" : "Generate a new patent search", explanation: byId.search.explanation, buttonLabel: "Go to patent search", target: "search" };
  }
  if (byId.overlap.status !== "COMPLETED") {
    const retry = byId.overlap.status === "ERROR";
    return { title: retry ? "Retry the overlap report" : "Generate an updated overlap report", explanation: byId.overlap.explanation, buttonLabel: "Go to overlap report", target: "overlap" };
  }
  if (byId.draft.status !== "COMPLETED") {
    const retry = byId.draft.status === "ERROR";
    return { title: retry ? "Retry patent-draft generation" : "Generate a new draft version", explanation: byId.draft.explanation, buttonLabel: "Go to patent draft", target: "draft" };
  }
  if (input.hasUnsavedDraftChanges) {
    return { title: "Save draft changes", explanation: "Export is paused until the current editor changes are saved.", buttonLabel: "Go to save controls", target: "draft-save" };
  }
  if (byId.export.status !== "COMPLETED") {
    return { title: "Prepare the draft for export", explanation: byId.export.explanation, buttonLabel: "Go to export", target: "export" };
  }
  return { title: "Workflow complete", explanation: "The current feature version has a matching search, report, saved draft, and export-ready document.", buttonLabel: "View export options", target: "export" };
}

export function calculateWorkflowState(input: WorkflowStateInput): WorkflowState {
  const steps: WorkflowStep[] = [];

  steps.push(step("details", input.detailsComplete
    ? { status: "COMPLETED", explanation: "The required invention details are saved." }
    : { status: "ACTION_REQUIRED", explanation: "Required invention details are missing." }));

  let featureState: Pick<WorkflowStep, "status" | "explanation">;
  if (input.featuresApproved) featureState = { status: "COMPLETED", explanation: `Feature set v${input.approvedFeatureSetVersion} is approved.` };
  else if (input.analysisStatus === "PROCESSING") featureState = { status: "IN_PROGRESS", explanation: "The invention analysis is processing." };
  else if (input.analysisStatus === "FAILED") featureState = { status: "ERROR", explanation: "The invention analysis failed and can be retried." };
  else if (input.analysisStatus === "NEEDS_REVIEW" || input.hasFeatureCandidates) featureState = { status: "ACTION_REQUIRED", explanation: "The extracted feature list needs review and approval." };
  else featureState = { status: "NOT_STARTED", explanation: "No feature review has been generated yet." };
  steps.push(step("features", featureState, input.featuresApproved ? input.approvedFeatureSetVersion : null));

  let searchState: Pick<WorkflowStep, "status" | "explanation">;
  if (!input.featuresApproved && input.latestSearch) searchState = {
    status: "OUTDATED",
    explanation: `Feature review is required. This search remains linked to feature set v${input.latestSearch.featureSetVersion}.`,
  };
  else if (!input.featuresApproved) searchState = { status: "NOT_STARTED", explanation: "Approve the feature list before searching patents." };
  else if (!input.latestSearch) searchState = { status: "ACTION_REQUIRED", explanation: `No patent search exists for approved feature set v${input.approvedFeatureSetVersion}.` };
  else if (input.latestSearch.featureSetVersion !== input.approvedFeatureSetVersion) searchState = {
    status: "OUTDATED",
    explanation: `This search used feature set v${input.latestSearch.featureSetVersion}, while the approved feature set is v${input.approvedFeatureSetVersion}.`,
  };
  else searchState = storedStatus(input.latestSearch.status, `The latest patent search uses feature set v${input.latestSearch.featureSetVersion}.`, "The latest patent search failed and can be retried.");
  steps.push(step("search", searchState, input.latestSearch?.featureSetVersion ?? null));

  let overlapState: Pick<WorkflowStep, "status" | "explanation">;
  if (!input.featuresApproved && input.latestOverlapReport) overlapState = {
    status: "OUTDATED",
    explanation: `Feature review is required. This report remains linked to feature set v${input.latestOverlapReport.featureSetVersion}.`,
  };
  else if (!input.featuresApproved || !input.latestCurrentSearchId) overlapState = { status: "NOT_STARTED", explanation: "Complete a current patent search before generating an overlap report." };
  else if (!input.latestOverlapReport) overlapState = { status: "ACTION_REQUIRED", explanation: "No overlap report exists for the latest current patent search." };
  else if (input.latestOverlapReport.featureSetVersion !== input.approvedFeatureSetVersion) overlapState = {
    status: "OUTDATED",
    explanation: `This report used feature set v${input.latestOverlapReport.featureSetVersion}, while the approved feature set is v${input.approvedFeatureSetVersion}.`,
  };
  else if (input.latestOverlapReport.patentSearchId !== input.latestCurrentSearchId) overlapState = {
    status: "OUTDATED",
    explanation: "This report belongs to an older patent search, not the latest current search.",
  };
  else overlapState = storedStatus(input.latestOverlapReport.status, `The latest overlap report uses feature set v${input.latestOverlapReport.featureSetVersion}.`, "The latest overlap report failed and can be retried.");
  steps.push(step("overlap", overlapState, input.latestOverlapReport?.featureSetVersion ?? null));

  let draftState: Pick<WorkflowStep, "status" | "explanation">;
  if (!input.featuresApproved && input.latestDraft) draftState = {
    status: "OUTDATED",
    explanation: `Feature review is required. This draft remains linked to feature set v${input.latestDraft.featureSetVersion}.`,
  };
  else if (!input.latestCurrentOverlapReportId) draftState = { status: "NOT_STARTED", explanation: "Complete a current overlap report before generating a patent draft." };
  else if (!input.latestDraft) draftState = { status: "ACTION_REQUIRED", explanation: "No patent draft exists for the latest current overlap report." };
  else if (input.latestDraft.featureSetVersion !== input.approvedFeatureSetVersion) draftState = {
    status: "OUTDATED",
    explanation: `This draft used feature set v${input.latestDraft.featureSetVersion}, while the approved feature set is v${input.approvedFeatureSetVersion}.`,
  };
  else if (input.latestDraft.overlapReportId !== input.latestCurrentOverlapReportId || input.latestDraft.patentSearchId !== input.latestCurrentSearchId) draftState = {
    status: "OUTDATED",
    explanation: "This draft belongs to an older search or overlap report.",
  };
  else if (input.latestDraft.status === "COMPLETED" && !input.latestDraft.sectionsComplete) draftState = {
    status: "ACTION_REQUIRED",
    explanation: "The saved draft contains an empty required section.",
  };
  else draftState = storedStatus(input.latestDraft.status, `Saved draft v${input.latestDraft.featureSetVersion} matches the current workflow.`, "The latest patent draft failed and can be retried.");
  steps.push(step("draft", draftState, input.latestDraft?.featureSetVersion ?? null));

  let exportState: Pick<WorkflowStep, "status" | "explanation">;
  if (input.hasUnsavedDraftChanges) exportState = { status: "ACTION_REQUIRED", explanation: "Save the current draft edits before exporting." };
  else if (draftState.status === "COMPLETED") exportState = { status: "COMPLETED", explanation: "The current saved draft is complete and ready for DOCX or PDF export." };
  else if (draftState.status === "ERROR") exportState = { status: "ERROR", explanation: "Export is unavailable because the current draft has an error." };
  else if (draftState.status === "OUTDATED") exportState = { status: "OUTDATED", explanation: "Export is unavailable until a draft matching the current workflow is generated." };
  else if (draftState.status === "ACTION_REQUIRED") exportState = { status: "ACTION_REQUIRED", explanation: "Export is unavailable until every required draft section is saved." };
  else exportState = { status: "NOT_STARTED", explanation: "A current saved patent draft is required before export." };
  steps.push(step("export", exportState, input.latestDraft?.featureSetVersion ?? null));

  const completedSteps = steps.filter((item) => item.status === "COMPLETED").length;
  return {
    steps,
    completedSteps,
    totalSteps: steps.length,
    completionPercentage: Math.round((completedSteps / steps.length) * 100),
    recommendation: recommendationFor(input, steps),
  };
}
