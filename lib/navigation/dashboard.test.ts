import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DASHBOARD_NAV_ITEMS, dashboardNavItemActive } from "./dashboard";

describe("dashboard navigation", () => {
  it("contains only implemented dashboard routes", () => {
    assert.deepEqual(DASHBOARD_NAV_ITEMS.map((item) => item.href), [
      "/dashboard",
      "/dashboard/inventions",
      "/dashboard/inventions/new",
    ]);
    assert.equal(DASHBOARD_NAV_ITEMS.some((item) => String(item.href) === "#"), false);
  });

  it("selects one specific sidebar destination", () => {
    assert.equal(dashboardNavItemActive("/dashboard", "/dashboard"), true);
    assert.equal(dashboardNavItemActive("/dashboard/inventions/new", "/dashboard/inventions/new"), true);
    assert.equal(dashboardNavItemActive("/dashboard/inventions/new", "/dashboard/inventions"), false);
    assert.equal(dashboardNavItemActive("/dashboard/inventions/abc", "/dashboard/inventions"), true);
  });
});
