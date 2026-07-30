import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPatentCostEstimate, normalizeDrawingCount, totalRange } from "./patent-cost-data";

describe("India patent-cost estimates", () => {
  it("changes excess-claim fees from claim 11", () => {
    assert.equal(getPatentCostEstimate("india", "individual", "complete", 10).governmentBreakdown?.excessClaimFee, 0);
    assert.equal(getPatentCostEstimate("india", "individual", "complete", 11).governmentBreakdown?.excessClaimFee, 320);
  });
  it("limits provisional amount due now to filing and professional support", () => {
    const estimate = getPatentCostEstimate("india", "startup", "provisional", 12);
    assert.deepEqual(estimate.government, { minimum: 1600, maximum: 1600 });
    assert.deepEqual(totalRange(estimate), { minimum: 16600, maximum: 51600 });
    assert.equal(estimate.governmentBreakdown?.futureExcessClaimFee, 640);
    assert.equal(estimate.governmentBreakdown?.examinationFee, 0);
    assert.match(estimate.completeSpecificationDeadline ?? "", /12 months/);
    assert.match(estimate.processingTime, /Not applicable/);
  });
  it("includes filing, examination, and claims for complete filings", () => {
    const estimate = getPatentCostEstimate("india", "small", "complete", 11);
    assert.equal(estimate.government.minimum, 5920);
    assert.equal(estimate.governmentBreakdown?.examinationFee, 4000);
    assert.match(estimate.processingTime, /3–5 years/);
    assert.match(estimate.patentTerm, /20 years/);
  });
  it("uses large-entity rates", () => {
    const estimate = getPatentCostEstimate("india", "large", "complete", 11);
    assert.equal(estimate.governmentBreakdown?.filingFee, 8000);
    assert.equal(estimate.governmentBreakdown?.examinationFee, 20000);
    assert.equal(estimate.governmentBreakdown?.excessClaimFee, 1600);
  });
  it("adds professional drawing preparation without fabricating a government fee", () => {
    const zero = getPatentCostEstimate("india", "individual", "complete", 10, 0);
    const three = getPatentCostEstimate("india", "individual", "complete", 10, 3);
    assert.deepEqual(zero.drawingPreparation, { minimum: 0, maximum: 0 });
    assert.deepEqual(three.drawingPreparation, { minimum: 4500, maximum: 12000 });
    assert.deepEqual(three.government, zero.government);
    assert.equal(three.professional.minimum - zero.professional.minimum, 4500);
  });
  it("normalizes drawing limits independently from claims", () => {
    assert.equal(normalizeDrawingCount(-2), 0);
    assert.equal(normalizeDrawingCount(101), 100);
    const estimate = getPatentCostEstimate("india", "individual", "provisional", 12, 3);
    assert.equal(estimate.governmentBreakdown?.futureExcessClaimFee, 640);
    assert.equal(estimate.drawingCount, 3);
    assert.equal(estimate.government.minimum, 1600);
  });
});
