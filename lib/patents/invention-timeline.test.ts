import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInventionTimeline,
  filterTimelineEvents,
  sortTimelineEvents,
  type InventionTimelineInput,
} from "./invention-timeline";

const at = (day: number) => `2026-07-${String(day).padStart(2, "0")}T10:00:00.000Z`;

function input(overrides: Partial<InventionTimelineInput> = {}): InventionTimelineInput {
  return {
    invention: {
      createdAt: at(1),
      updatedAt: at(2),
      aiStatus: "APPROVED",
      featureSetVersion: 2,
      approvedFeatureCount: 2,
      clarification: null,
    },
    searches: [],
    reports: [],
    drafts: [],
    ...overrides,
  };
}

function completeInput(): InventionTimelineInput {
  return input({
    searches: [{ id: "search-current", status: "COMPLETED", featureSetVersion: 2, createdAt: at(3), updatedAt: at(4) }],
    reports: [{ id: "report-current", patentSearchId: "search-current", status: "COMPLETED", featureSetVersion: 2, createdAt: at(5), updatedAt: at(6) }],
    drafts: [{ id: "draft-current", patentSearchId: "search-current", overlapReportId: "report-current", status: "COMPLETED", featureSetVersion: 2, version: 2, createdAt: at(7), updatedAt: at(8), acknowledgementAt: at(7), edited: true }],
  });
}

describe("buildInventionTimeline", () => {
  it("returns an empty workflow when no invention exists", () => {
    assert.deepEqual(buildInventionTimeline(input({ invention: null })), []);
  });

  it("builds a complete workflow timeline", () => {
    const events = buildInventionTimeline(completeInput());
    assert.ok(events.some((event) => event.title === "Invention created"));
    assert.ok(events.some((event) => event.title === "Feature set approved"));
    assert.ok(events.some((event) => event.title === "Patent search completed"));
    assert.ok(events.some((event) => event.title === "Overlap report generated"));
    assert.ok(events.some((event) => event.title === "Patent draft generated"));
    assert.ok(events.some((event) => event.title === "Patent draft edited and saved"));
  });

  it("keeps multiple feature-set versions and marks older searches outdated", () => {
    const events = buildInventionTimeline(input({ searches: [
      { id: "search-old", status: "COMPLETED", featureSetVersion: 1, createdAt: at(3), updatedAt: at(4) },
      { id: "search-current", status: "COMPLETED", featureSetVersion: 2, createdAt: at(5), updatedAt: at(6) },
    ] }));
    assert.ok(events.some((event) => event.category === "SEARCHES" && event.featureSetVersion === 1 && event.recordState === "OUTDATED"));
    assert.ok(events.some((event) => event.category === "SEARCHES" && event.featureSetVersion === 2 && event.recordState === "CURRENT"));
  });

  it("marks reports and drafts from older source chains outdated", () => {
    const complete = completeInput();
    const events = buildInventionTimeline({
      ...complete,
      reports: [...complete.reports, { id: "report-old", patentSearchId: "search-old", status: "COMPLETED", featureSetVersion: 1, createdAt: at(3), updatedAt: at(4) }],
      drafts: [...complete.drafts, { id: "draft-old", patentSearchId: "search-old", overlapReportId: "report-old", status: "COMPLETED", featureSetVersion: 1, version: 1, createdAt: at(4), updatedAt: at(4), acknowledgementAt: at(4), edited: false }],
    });
    assert.ok(events.some((event) => event.category === "REPORTS" && event.featureSetVersion === 1 && event.recordState === "OUTDATED"));
    assert.ok(events.some((event) => event.category === "DRAFTS" && event.featureSetVersion === 1 && event.recordState === "OUTDATED"));
  });

  it("shows failed searches and reports as errors", () => {
    const events = buildInventionTimeline(input({
      searches: [{ id: "search-failed", status: "FAILED", featureSetVersion: 2, createdAt: at(3), updatedAt: at(4) }],
      reports: [{ id: "report-failed", patentSearchId: "search-failed", status: "FAILED", featureSetVersion: 2, createdAt: at(5), updatedAt: at(6) }],
    }));
    assert.equal(filterTimelineEvents(events, "ERRORS").length, 2);
  });

  it("sorts chronologically in both directions", () => {
    const events = buildInventionTimeline(completeInput()).filter((event) => event.timestampMs !== null);
    const newest = sortTimelineEvents(events, "newest");
    const oldest = sortTimelineEvents(events, "oldest");
    assert.ok((newest[0].timestampMs ?? 0) >= (newest.at(-1)?.timestampMs ?? 0));
    assert.ok((oldest[0].timestampMs ?? 0) <= (oldest.at(-1)?.timestampMs ?? 0));
  });

  it("filters by activity category", () => {
    const events = buildInventionTimeline(completeInput());
    assert.ok(filterTimelineEvents(events, "DRAFTS").every((event) => event.category === "DRAFTS"));
    assert.ok(filterTimelineEvents(events, "FEATURES").every((event) => event.category === "FEATURES"));
  });

  it("keeps missing or malformed timestamps with a fallback", () => {
    const events = buildInventionTimeline(input({
      invention: { createdAt: "not-a-date", updatedAt: null, aiStatus: "NOT_STARTED", featureSetVersion: 0, approvedFeatureCount: 0, clarification: null },
      searches: [{ id: "search", status: "FAILED", featureSetVersion: 0, createdAt: null, updatedAt: "invalid" }],
    }));
    assert.ok(events.length > 0);
    assert.ok(events.every((event) => event.timestamp === null && event.timestampMs === null));
  });
});
