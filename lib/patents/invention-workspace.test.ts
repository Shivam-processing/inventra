import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WORKSPACE_SECTION_IDS,
  adjacentWorkspaceSection,
  buildWorkspaceSectionStates,
  isWorkspaceSection,
  recommendedWorkspaceSection,
  resolveWorkspaceSection,
  workspacePanelVisibility,
  workspaceSectionUrl,
} from "./invention-workspace";
import { calculateWorkflowState, type WorkflowStateInput } from "./workflow-state";

function input(overrides: Partial<WorkflowStateInput> = {}): WorkflowStateInput {
  return {
    detailsComplete: true,
    analysisStatus: "NOT_STARTED",
    hasFeatureCandidates: false,
    featuresApproved: false,
    approvedFeatureSetVersion: 0,
    latestSearch: null,
    latestCurrentSearchId: null,
    latestOverlapReport: null,
    latestCurrentOverlapReportId: null,
    latestDraft: null,
    hasUnsavedDraftChanges: false,
    ...overrides,
  };
}

describe("invention workspace navigation", () => {
  it("accepts only stable section identifiers", () => {
    assert.ok(WORKSPACE_SECTION_IDS.every((id) => isWorkspaceSection(id)));
    assert.equal(isWorkspaceSection("search-results"), false);
  });

  it("uses the recommended section when missing and Overview for invalid values", () => {
    assert.equal(resolveWorkspaceSection(null, "patent-search"), "patent-search");
    assert.equal(resolveWorkspaceSection("invalid", "patent-search"), "overview");
  });

  it("maps the recommended workflow action to the correct default section", () => {
    const state = calculateWorkflowState(input());
    assert.equal(recommendedWorkspaceSection(state, "NOT_STARTED"), "analysis");
    const review = calculateWorkflowState(input({ analysisStatus: "NEEDS_REVIEW", hasFeatureCandidates: true }));
    assert.equal(recommendedWorkspaceSection(review, "NEEDS_REVIEW"), "feature-review");
  });

  it("preserves other URL parameters when changing sections", () => {
    const url = workspaceSectionUrl("patent_q=sensor&patent_page=2", "comparison-matrix");
    const params = new URLSearchParams(url.slice(1));
    assert.equal(params.get("section"), "comparison-matrix");
    assert.equal(params.get("patent_q"), "sensor");
    assert.equal(params.get("patent_page"), "2");
  });

  it("provides stable Previous and Next navigation", () => {
    assert.equal(adjacentWorkspaceSection("overview", -1), null);
    assert.equal(adjacentWorkspaceSection("overview", 1), "invention-details");
    assert.equal(adjacentWorkspaceSection("activity", 1), null);
    assert.equal(adjacentWorkspaceSection("activity", -1), "export");
  });

  it("adds conditional locked-state messaging", () => {
    const state = calculateWorkflowState(input());
    const sections = buildWorkspaceSectionStates({ workflow: state, analysisStatus: "NOT_STARTED", imageCount: 0, hasPatentResults: false });
    assert.match(sections.find((section) => section.id === "patent-search")?.lockedMessage ?? "", /Approve the feature list/);
    assert.match(sections.find((section) => section.id === "patent-draft")?.lockedMessage ?? "", /overlap report/);
  });

  it("maps workflow and supporting section statuses", () => {
    const state = calculateWorkflowState(input({ analysisStatus: "PROCESSING" }));
    const sections = buildWorkspaceSectionStates({ workflow: state, analysisStatus: "PROCESSING", imageCount: 2, hasPatentResults: false });
    assert.equal(sections.find((section) => section.id === "images")?.status, "COMPLETED");
    assert.equal(sections.find((section) => section.id === "analysis")?.status, "IN_PROGRESS");
    assert.equal(sections.find((section) => section.id === "comparison-matrix")?.status, "NOT_STARTED");
  });

  it("uses the same validated identifiers for mobile selection", () => {
    assert.equal(resolveWorkspaceSection("activity", "overview"), "activity");
    assert.equal(resolveWorkspaceSection("timeline", "overview"), "activity");
    assert.equal(resolveWorkspaceSection("history", "overview"), "activity");
    assert.equal(resolveWorkspaceSection("not-a-mobile-option", "overview"), "overview");
  });

  it("keeps every panel mounted while switching visibility", () => {
    const before = workspacePanelVisibility("analysis");
    const after = workspacePanelVisibility("feature-review");
    assert.deepEqual(before.map((panel) => panel.key), after.map((panel) => panel.key));
    assert.equal(before.find((panel) => panel.sections.includes("analysis"))?.hidden, false);
    assert.equal(after.find((panel) => panel.sections.includes("feature-review"))?.hidden, false);
  });
});
