import assert from "node:assert/strict";
import test from "node:test";
import type { FeatureOverlapMatch, OverlapMatchType } from "@/lib/patents/overlap-types";
import {
  aggregateMatchStatuses,
  aggregatePatentAssessments,
  authenticatedUserId,
  calculateOverlapRiskScore,
  createReportCode,
  fullReportRequestSchema,
  fullReportResponseHeaders,
  overlapFeatureExtremes,
  reportFilename,
  sanitizePdfText,
  strongestPatentMatch,
  validateCurrentReportWorkflow,
} from "@/lib/reports/full-report-utils";

function match(feature: string, matchType: OverlapMatchType): FeatureOverlapMatch {
  return { feature, matchType, matchedPatentTitle: null, publicationNumber: null, matchedKeywords: [], explanation: "Stored explanation" };
}

test("calculates the deterministic overlap-risk score", () => {
  assert.equal(calculateOverlapRiskScore([match("A", "FULL"), match("B", "PARTIAL"), match("C", "UNCERTAIN"), match("D", "NOT_FOUND")]), 48);
});

test("aggregates every match status", () => {
  assert.deepEqual(aggregateMatchStatuses([match("A", "FULL"), match("B", "FULL"), match("C", "NOT_FOUND")]), { FULL: 2, PARTIAL: 0, NOT_FOUND: 1, UNCERTAIN: 0 });
});

test("finds strongest and lowest observed feature", () => {
  assert.deepEqual(overlapFeatureExtremes([match("Valve arrangement", "PARTIAL"), match("Control linkage", "FULL"), match("Housing", "NOT_FOUND")]), { strongest: "Control linkage", lowest: "Housing" });
});

test("retains tied lowest-overlap features without arbitrary selection", () => {
  assert.equal(overlapFeatureExtremes([match("Feature A", "NOT_FOUND"), match("Feature B", "NOT_FOUND"), match("Feature C", "FULL")]).lowest, "Feature A; Feature B");
});

test("does not infer a patent status from incomplete feature comparisons", () => {
  assert.equal(strongestPatentMatch("EP1", [{ ...match("A", "FULL"), publicationNumber: "EP1" }], 2), "NOT_ASSESSED");
  assert.equal(strongestPatentMatch("EP1", [{ ...match("A", "PARTIAL"), publicationNumber: "EP1" }, { ...match("B", "FULL"), publicationNumber: "EP1" }], 2), "FULL");
});

test("separates patent counts and unassessed patents", () => {
  const assessments = aggregatePatentAssessments(["EP1", "EP2"], [{ ...match("A", "FULL"), publicationNumber: "EP1" }], 2);
  assert.deepEqual(assessments.counts, { FULL: 0, PARTIAL: 0, NOT_FOUND: 0, UNCERTAIN: 0, NOT_ASSESSED: 2 });
  assert.equal(assessments.fullyAssessed, false);
});

test("sanitizes unsupported PDF text characters", () => {
  assert.equal(sanitizePdfText("COM\u00ADPARTMENT\u200B RE\uFFFDVIEWED"), "COMPARTMENT REVIEWED");
});

test("sanitizes full-report filenames", () => {
  assert.equal(reportFilename("../../Pressure / Valve: Mk II", 3), "pressure-valve-mk-ii-inventra-analysis-v3.pdf");
});

test("creates the required report-code format", () => {
  assert.match(createReportCode(new Date("2026-07-25T10:00:00Z"), "case-1"), /^INV-20260725-[A-F0-9]{4}$/);
});

test("rejects an invalid invention UUID", () => {
  assert.equal(fullReportRequestSchema.safeParse({ inventionId: "not-a-uuid" }).success, false);
});

test("rejects an unauthenticated subject", () => {
  assert.equal(authenticatedUserId(null, undefined), null);
  assert.equal(authenticatedUserId(new Error("auth"), "user-1"), null);
});

test("rejects a stale or mismatched workflow chain", () => {
  const search = { id: "search", invention_id: "invention", user_id: "user", feature_set_version: 1 };
  const report = { id: "report", invention_id: "invention", patent_search_id: "search", user_id: "user", feature_set_version: 1 };
  const draft = { id: "draft", invention_id: "invention", patent_search_id: "search", overlap_report_id: "report", user_id: "user", feature_set_version: 1 };
  assert.equal(validateCurrentReportWorkflow({ inventionId: "invention", userId: "user", featureSetVersion: 2, search, report, draft }), false);
  assert.equal(validateCurrentReportWorkflow({ inventionId: "invention", userId: "user", featureSetVersion: 1, search, report, draft }), true);
});

test("uses the PDF response content type", () => {
  const headers = new Headers(fullReportResponseHeaders("report.pdf", 42));
  assert.equal(headers.get("content-type"), "application/pdf");
  assert.equal(headers.get("cache-control"), "private, no-store");
});
