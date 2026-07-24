import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateWorkflowState, type WorkflowStateInput } from "./workflow-state";

function input(overrides: Partial<WorkflowStateInput> = {}): WorkflowStateInput {
  return {
    detailsComplete: false,
    analysisStatus: "NOT_STARTED",
    hasFeatureCandidates: false,
    featuresApproved: false,
    approvedFeatureSetVersion: 1,
    latestSearch: null,
    latestCurrentSearchId: null,
    latestOverlapReport: null,
    latestCurrentOverlapReportId: null,
    latestDraft: null,
    hasUnsavedDraftChanges: false,
    ...overrides,
  };
}

function fullyCurrent(overrides: Partial<WorkflowStateInput> = {}) {
  return input({
    detailsComplete: true,
    analysisStatus: "APPROVED",
    hasFeatureCandidates: true,
    featuresApproved: true,
    approvedFeatureSetVersion: 2,
    latestSearch: { id: "search-current", status: "COMPLETED", featureSetVersion: 2 },
    latestCurrentSearchId: "search-current",
    latestOverlapReport: { id: "overlap-current", patentSearchId: "search-current", status: "COMPLETED", featureSetVersion: 2 },
    latestCurrentOverlapReportId: "overlap-current",
    latestDraft: { id: "draft-current", patentSearchId: "search-current", overlapReportId: "overlap-current", status: "COMPLETED", featureSetVersion: 2, sectionsComplete: true },
    ...overrides,
  });
}

function status(state: ReturnType<typeof calculateWorkflowState>, id: string) {
  return state.steps.find((step) => step.id === id)?.status;
}

describe("calculateWorkflowState", () => {
  it("handles a completely empty workflow", () => {
    const state = calculateWorkflowState(input());
    assert.equal(status(state, "details"), "ACTION_REQUIRED");
    assert.equal(status(state, "features"), "NOT_STARTED");
    assert.equal(status(state, "search"), "NOT_STARTED");
    assert.equal(state.recommendation.title, "Complete invention details");
  });

  it("requires a search after feature approval", () => {
    const state = calculateWorkflowState(input({ detailsComplete: true, analysisStatus: "APPROVED", featuresApproved: true, hasFeatureCandidates: true, approvedFeatureSetVersion: 2 }));
    assert.equal(status(state, "features"), "COMPLETED");
    assert.equal(status(state, "search"), "ACTION_REQUIRED");
    assert.equal(state.recommendation.title, "Generate a new patent search");
  });

  it("marks a fully current workflow complete", () => {
    const state = calculateWorkflowState(fullyCurrent());
    assert.equal(state.completedSteps, 6);
    assert.equal(state.completionPercentage, 100);
    assert.equal(state.recommendation.title, "Workflow complete");
  });

  it("marks a stale search outdated", () => {
    const state = calculateWorkflowState(fullyCurrent({ latestSearch: { id: "search-old", status: "COMPLETED", featureSetVersion: 1 } }));
    assert.equal(status(state, "search"), "OUTDATED");
    assert.match(state.steps.find((step) => step.id === "search")?.explanation ?? "", /v1.*v2/);
  });

  it("marks an overlap report tied to an older search outdated", () => {
    const state = calculateWorkflowState(fullyCurrent({ latestOverlapReport: { id: "overlap-old", patentSearchId: "search-old", status: "COMPLETED", featureSetVersion: 2 } }));
    assert.equal(status(state, "overlap"), "OUTDATED");
  });

  it("marks a draft tied to an older overlap report outdated", () => {
    const state = calculateWorkflowState(fullyCurrent({ latestDraft: { id: "draft-old", patentSearchId: "search-current", overlapReportId: "overlap-old", status: "COMPLETED", featureSetVersion: 2, sectionsComplete: true } }));
    assert.equal(status(state, "draft"), "OUTDATED");
    assert.equal(status(state, "export"), "OUTDATED");
  });

  it("requires action for an incomplete saved draft", () => {
    const state = calculateWorkflowState(fullyCurrent({ latestDraft: { id: "draft-current", patentSearchId: "search-current", overlapReportId: "overlap-current", status: "COMPLETED", featureSetVersion: 2, sectionsComplete: false } }));
    assert.equal(status(state, "draft"), "ACTION_REQUIRED");
    assert.equal(status(state, "export"), "ACTION_REQUIRED");
  });

  it("requires saving unsaved draft changes before export", () => {
    const state = calculateWorkflowState(fullyCurrent({ hasUnsavedDraftChanges: true }));
    assert.equal(status(state, "draft"), "COMPLETED");
    assert.equal(status(state, "export"), "ACTION_REQUIRED");
    assert.equal(state.recommendation.title, "Save draft changes");
  });

  it("marks downstream records outdated when clarification requires feature review", () => {
    const state = calculateWorkflowState(fullyCurrent({
      analysisStatus: "NEEDS_REVIEW",
      featuresApproved: false,
      approvedFeatureSetVersion: 3,
      latestSearch: { id: "search-old", status: "COMPLETED", featureSetVersion: 2 },
      latestCurrentSearchId: null,
      latestOverlapReport: { id: "overlap-old", patentSearchId: "search-old", status: "COMPLETED", featureSetVersion: 2 },
      latestCurrentOverlapReportId: null,
      latestDraft: { id: "draft-old", patentSearchId: "search-old", overlapReportId: "overlap-old", status: "COMPLETED", featureSetVersion: 2, sectionsComplete: true },
    }));
    assert.equal(status(state, "search"), "OUTDATED");
    assert.equal(status(state, "overlap"), "OUTDATED");
    assert.equal(status(state, "draft"), "OUTDATED");
    assert.equal(status(state, "export"), "OUTDATED");
    assert.equal(state.recommendation.title, "Review and approve the feature list");
  });
});
