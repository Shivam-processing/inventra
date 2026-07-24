import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_PATENT_RESULT_FILTERS,
  extractPatentJurisdiction,
  filterPatentResults,
  paginatePatentResults,
  type FilterablePatentResult,
  type PatentResultFilters,
} from "./patent-result-filter";

type Result = FilterablePatentResult & { id: string };

const results: Result[] = [
  { id: "a", title: "Pressure release valve", publicationNumber: "EP1234567A1", priorityDate: "2020-04-10", publicationDate: "2021-01-20", abstract: "A sensor detects an unsafe pressure threshold." },
  { id: "b", title: "Independent safety controller", publicationNumber: "US9876543B2", priorityDate: null, publicationDate: "2023-08-02", abstract: "A standalone controller operates an actuator." },
  { id: "c", title: "Mechanical vent", publicationNumber: "INVALID", priorityDate: null, publicationDate: null, abstract: null },
];

function filters(overrides: Partial<PatentResultFilters> = {}): PatentResultFilters {
  return { ...EMPTY_PATENT_RESULT_FILTERS, ...overrides };
}

function filtered(overrides: Partial<PatentResultFilters> = {}) {
  return filterPatentResults(results, filters(overrides), { searchFeatureSetVersion: 2, isCurrentSearch: true });
}

describe("patent result filtering", () => {
  it("matches keywords case-insensitively across title, abstract, and publication number", () => {
    assert.deepEqual(filtered({ keyword: "  PRESSURE " }).results.map((result) => result.id), ["a"]);
    assert.deepEqual(filtered({ keyword: "us987" }).results.map((result) => result.id), ["b"]);
  });

  it("matches publication numbers independently", () => {
    assert.deepEqual(filtered({ publicationNumber: "34567a" }).results.map((result) => result.id), ["a"]);
  });

  it("extracts jurisdiction only from a publication-number prefix", () => {
    assert.equal(extractPatentJurisdiction("EP 1234567 A1"), "EP");
    assert.equal(extractPatentJurisdiction("WO-2024-123456"), "WO");
    assert.equal(extractPatentJurisdiction("1234567"), null);
    assert.deepEqual(filtered({ jurisdiction: "US" }).results.map((result) => result.id), ["b"]);
  });

  it("supports independent and bounded date ranges", () => {
    assert.deepEqual(filtered({ dateFrom: "2021-01-01" }).results.map((result) => result.id), ["b"]);
    assert.deepEqual(filtered({ dateTo: "2021-01-01" }).results.map((result) => result.id), ["a"]);
    assert.deepEqual(filtered({ dateFrom: "2019-01-01", dateTo: "2021-12-31" }).results.map((result) => result.id), ["a"]);
  });

  it("keeps missing dates without a date filter and excludes them with one", () => {
    assert.equal(filtered().results.length, 3);
    assert.ok(!filtered({ dateFrom: "2000-01-01" }).results.some((result) => result.id === "c"));
  });

  it("sorts by date, title, and publication number while preserving the default order", () => {
    assert.deepEqual(filtered().results.map((result) => result.id), ["a", "b", "c"]);
    assert.deepEqual(filtered({ sort: "closest" }).results.map((result) => result.id), ["a", "b", "c"]);
    assert.deepEqual(filtered({ sort: "newest" }).results.map((result) => result.id), ["b", "a", "c"]);
    assert.deepEqual(filtered({ sort: "oldest" }).results.map((result) => result.id), ["a", "b", "c"]);
    assert.deepEqual(filtered({ sort: "title" }).results.map((result) => result.id), ["b", "c", "a"]);
    assert.deepEqual(filtered({ sort: "publication" }).results.map((result) => result.id), ["a", "c", "b"]);
  });

  it("rejects invalid and reversed ranges without hiding results", () => {
    const invalid = filtered({ dateFrom: "2024-02-30" });
    assert.match(invalid.validationError ?? "", /valid start date/);
    assert.equal(invalid.results.length, 3);

    const reversed = filtered({ dateFrom: "2024-01-02", dateTo: "2024-01-01" });
    assert.match(reversed.validationError ?? "", /start date/);
    assert.equal(reversed.results.length, 3);
  });

  it("paginates ten results by default and clamps invalid pages", () => {
    const many = Array.from({ length: 23 }, (_, index) => index);
    assert.deepEqual(paginatePatentResults(many, 2), { items: many.slice(10, 20), page: 2, pageSize: 10, totalPages: 3 });
    assert.equal(paginatePatentResults(many, 99).page, 3);
  });

  it("returns zero results for unmatched filters", () => {
    assert.equal(filtered({ keyword: "quantum turbine" }).results.length, 0);
  });
});
