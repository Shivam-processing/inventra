import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("final UX structure", () => {
  it("uses the Workshop appearance without a selectable theme", () => {
    assert.equal(existsSync(new URL("../../lib/theme.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../../components/theme-switcher.tsx", import.meta.url)), false);
    assert.doesNotMatch(source("app/layout.tsx"), /data-theme|ThemeProvider|THEME_COOKIE/);
    assert.doesNotMatch(source("app/globals.css"), /data-theme|color-scheme:\s*dark/);
  });

  it("shows password visibility and a contained existing confirmation state", () => {
    const form = source("components/auth-form.tsx");
    assert.match(form, /showPassword/);
    assert.match(form, /auth-confirmation-message/);
    assert.doesNotMatch(form, /forgotPassword/);
  });

  it("provides a concise home dashboard and first-invention onboarding", () => {
    const page = source("app/dashboard/page.tsx");
    assert.match(page, /Welcome to Inventra|dashboard\.welcome/);
    assert.match(page, /slice\(0, 3\)/);
    assert.match(page, /DASHBOARD_FEATURES/);
    assert.match(page, /FirstInventionOnboarding/);
  });

  it("uses accessible progressive-disclosure tabs for complex tools", () => {
    for (const file of ["components/grant-finder.tsx", "components/manufacturing-finder.tsx", "components/trademark-search-workspace.tsx"]) {
      const value = source(file);
      assert.match(value, /role="tablist"/);
      assert.match(value, /role="tab"/);
      assert.match(value, /role="tabpanel"/);
    }
  });

  it("keeps advanced manufacturing fields hidden in Basic mode without clearing values", () => {
    const profile = source("components/manufacturing-input-profile.tsx");
    assert.match(profile, /useState<"basic" \| "advanced">\("basic"\)/);
    assert.match(profile, /mode === "advanced"/);
    assert.match(profile, /common\.advanced/);
  });

  it("provides recommendation, lock reasons and previous-next workflow navigation", () => {
    const workspace = source("components/invention-workspace.tsx");
    assert.match(workspace, /workspace\.recommendedNext/);
    assert.match(workspace, /lockedMessage/);
    assert.match(workspace, /Previous and next workflow sections/);
  });

  it("adds a compact help centre and responsive overflow safeguards", () => {
    assert.match(source("app/dashboard/help/page.tsx"), /Common terms/);
    const css = source("app/globals.css");
    assert.match(css, /@media \(max-width: 780px\)/);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /prefers-reduced-motion/);
  });
});
