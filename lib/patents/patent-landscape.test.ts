import assert from "node:assert/strict";
import test from "node:test";
import type { LandscapePatent } from "@/lib/patents/patent-landscape";
import {
  buildPatentLandscape,
  classifyObservedOverlap,
  filterLandscapePatents,
  limitTopPatents,
  observedOverlapScore,
  sortLandscapeTimeline,
  timelineInsight,
} from "@/lib/patents/patent-landscape";

function patent(overrides: Partial<LandscapePatent> = {}): LandscapePatent {
  return { publicationNumber: "EP1", title: "Sensor valve", applicant: "Acme", date: "2024-01-01", abstract: "Text", sourceUrl: null, score: 60, classification: "partial", counts: { FULL: 0, PARTIAL: 1, NOT_FOUND: 0, UNCERTAIN: 0 }, comparisons: [], ...overrides };
}

test("calculates overlap scores and classifications", () => {
  assert.equal(observedOverlapScore([{ matchType: "FULL" }, { matchType: "PARTIAL" }, { matchType: "NOT_FOUND" }]), 53);
  assert.equal(classifyObservedOverlap(70), "high");
  assert.equal(classifyObservedOverlap(35), "partial");
  assert.equal(classifyObservedOverlap(34), "low");
});

test("handles missing or unreliable comparisons", () => {
  assert.equal(observedOverlapScore([]), null);
  assert.equal(observedOverlapScore([{ matchType: "UNCERTAIN" }]), null);
  assert.equal(classifyObservedOverlap(null), "insufficient");
});

test("transforms search results into graph-ready patents", () => {
  const result = buildPatentLandscape(["pressure sensor valve"], [{ title: "Pressure sensor valve", publicationNumber: "EP1", priorityDate: "2024-01-01", publicationDate: null, applicant: null, abstract: "A pressure sensor valve responds to pressure.", sourceId: "EP1", sourceUrl: "https://example.com/patent" }]);
  assert.equal(result[0].publicationNumber, "EP1");
  assert.equal(result[0].applicant, "Not listed");
  assert.equal(result[0].classification, "high");
});

test("sorts timeline dates earliest first and missing dates last", () => {
  assert.deepEqual(sortLandscapeTimeline([patent({ publicationNumber: "B", date: null }), patent({ publicationNumber: "A", date: "2020-01-01" })]).map((item) => item.publicationNumber), ["A", "B"]);
});

test("filters by status, applicant, date, and search text", () => {
  const patents = [patent(), patent({ publicationNumber: "US2", title: "Release housing", applicant: "Beta", date: "2020-01-01", classification: "high", score: 90 })];
  const base = { query: "", classification: "all" as const, applicant: "", dateFrom: "", dateTo: "" };
  assert.equal(filterLandscapePatents(patents, { ...base, classification: "high" }).length, 1);
  assert.equal(filterLandscapePatents(patents, { ...base, applicant: "Beta" }).length, 1);
  assert.equal(filterLandscapePatents(patents, { ...base, dateFrom: "2023-01-01" }).length, 1);
  assert.equal(filterLandscapePatents(patents, { ...base, query: "us2" }).length, 1);
});

test("limits patents by highest observed score", () => {
  assert.deepEqual(limitTopPatents([patent({ publicationNumber: "A", score: 10 }), patent({ publicationNumber: "B", score: 90 })], 1).map((item) => item.publicationNumber), ["B"]);
});

test("generates deterministic timeline insight text", () => {
  assert.equal(timelineInsight([patent({ date: null })]), "Too few dated results are available for a reliable trend.");
  assert.equal(timelineInsight([patent({ date: "2024-01-01" }), patent({ publicationNumber: "B", date: "2025-01-01" }), patent({ publicationNumber: "C", date: "2026-01-01" })]), "Recent search results are concentrated in the last three years.");
});
