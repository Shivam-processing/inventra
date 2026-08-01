import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DASHBOARD_FEATURES, TOUR_STEPS, dashboardInventionProgress } from "./dashboard";

describe("dashboard onboarding", () => {
  it("keeps the tour optional and at five steps", () => assert.equal(TOUR_STEPS.length, 5));
  it("routes all four starting cards and marks invention requirements", () => {
    assert.deepEqual(DASHBOARD_FEATURES.map((item) => item.href), ["/dashboard/inventions?intent=patent-workspace", "/dashboard/grants", "/dashboard/manufacturing", "/dashboard/trademarks"]);
    assert.equal(DASHBOARD_FEATURES.at(-1)?.requiresInvention, false);
  });
  it("provides understandable progress labels", () => {
    assert.equal(dashboardInventionProgress("NEEDS_REVIEW").stage, "Feature review");
    assert.equal(dashboardInventionProgress("NEEDS_REVIEW").section, "feature-review");
    assert.equal(dashboardInventionProgress(null).percent, 12);
  });
});
