import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPatentComparisonMatrix,
  compareFeatureToPatent,
  isPatentComparisonStale,
  updatePatentSelection,
  type ComparisonPatent,
} from "./feature-comparison";

const patent = (overrides: Partial<ComparisonPatent> = {}): ComparisonPatent => ({
  title: "Pressure sensor control",
  publicationNumber: "EP123A1",
  abstract: "A pressure sensor detects a threshold and activates a release valve.",
  ...overrides,
});

describe("patent feature comparison", () => {
  it("identifies a full match", () => {
    assert.equal(compareFeatureToPatent("Pressure sensor detects threshold", patent()).matchType, "FULL");
  });

  it("identifies a partial match", () => {
    const match = compareFeatureToPatent("Pressure sensor controls remote locking mechanism", patent());
    assert.equal(match.matchType, "PARTIAL");
    assert.deepEqual(match.matchedKeywords, ["pressure", "sensor"]);
  });

  it("identifies a not-found match", () => {
    assert.equal(compareFeatureToPatent("Wireless optical alignment module", patent()).matchType, "NOT_FOUND");
  });

  it("marks insufficient feature or patent text uncertain", () => {
    assert.equal(compareFeatureToPatent("Sensor", patent()).matchType, "UNCERTAIN");
    assert.equal(compareFeatureToPatent("Pressure sensing controller", patent({ title: "Valve", abstract: null })).matchType, "UNCERTAIN");
  });

  it("compares multiple features against multiple patents", () => {
    const matrix = buildPatentComparisonMatrix(
      ["Pressure sensor detects threshold", "Wireless optical alignment module"],
      [patent(), patent({ title: "Optical alignment module", publicationNumber: "US456B2", abstract: "Wireless optical alignment module." })],
    );
    assert.equal(matrix.cells.length, 2);
    assert.equal(matrix.cells[0].length, 2);
    assert.equal(matrix.patentSummaries.length, 2);
    assert.equal(matrix.featureSummaries.length, 2);
  });

  it("prevents selection beyond five patents", () => {
    const current = ["1", "2", "3", "4", "5"];
    assert.deepEqual(updatePatentSelection(current, "6", true), { selection: current, limitReached: true });
    assert.deepEqual(updatePatentSelection(current, "5", false).selection, ["1", "2", "3", "4"]);
  });

  it("calculates the strongest feature match and matching patent count", () => {
    const matrix = buildPatentComparisonMatrix(
      ["Pressure sensor detects threshold"],
      [patent(), patent({ title: "Pressure housing assembly", publicationNumber: "US456B2", abstract: "A pressure enclosure." })],
    );
    assert.equal(matrix.featureSummaries[0].strongestMatch, "FULL");
    assert.equal(matrix.featureSummaries[0].matchingPatentCount, 1);
  });

  it("detects stale feature-set versions", () => {
    assert.equal(isPatentComparisonStale(1, 2), true);
    assert.equal(isPatentComparisonStale(2, 2), false);
  });
});
