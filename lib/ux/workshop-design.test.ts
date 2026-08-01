import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Workshop design system", () => {
  it("defines the approved warm light tokens as the only appearance", () => {
    const css = source("app/globals.css");
    for (const token of [
      "--page-bg: #FEFCF9",
      "--card-bg: #FFFFFF",
      "--sidebar-bg: #F0EBE4",
      "--primary: #D4603A",
      "--input-focus-border: #D4603A",
    ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(css, /data-theme|prefers-color-scheme:\s*dark|color-scheme:\s*dark/);
    assert.match(css, /body \{[^}]*font-size: 15px/);
    assert.match(source("app/layout.tsx"), /DM_Sans/);
  });

  it("uses the existing routes in the four requested sidebar groups", () => {
    const navigation = source("lib/navigation/dashboard.ts");
    for (const group of ["invent", "protect", "grow", "account"]) assert.match(navigation, new RegExp(`id: "${group}"`));
    for (const route of ["/dashboard/inventions/new", "/dashboard/grants", "/dashboard/manufacturing", "/dashboard/trademarks"]) assert.match(navigation, new RegExp(route.replaceAll("/", "\\/")));
  });

  it("presents a four-step creation wizard without replacing the secure submit flow", () => {
    const wizard = source("components/invention-form.tsx");
    assert.match(source("lib/inventions/creation-wizard.ts"), /\["idea", "difference", "activity", "review"\]/);
    assert.match(wizard, /createInvention/);
    for (const step of ["idea", "difference", "activity", "review"]) assert.match(wizard, new RegExp(`hidden=\\{currentStep !== "${step}"\\}`));
    assert.match(wizard, /window\.history\.pushState/);
    assert.match(source("app/dashboard/inventions/actions.ts"), /section=images&created=1/);
  });

  it("groups both marketing and authenticated workflows into four phases", () => {
    const landing = source("components/landing-experience.tsx");
    const workspace = source("components/invention-workspace.tsx");
    for (const phase of ["capture", "understand", "compare", "protect"]) {
      assert.match(landing, new RegExp(`id: "${phase}"`));
      assert.match(workspace, new RegExp(`id: "${phase}"`));
    }
    assert.match(workspace, /workspace\.recommendedNext/);
  });

  it("keeps authenticated pages mascot-free and preserves responsive accessibility safeguards", () => {
    const css = source("app/globals.css");
    assert.doesNotMatch(css, /\.floating-mascot|\.global-mascot|\.assistant-orb|\.codex-robot/);
    assert.match(css, /@media \(max-width: 780px\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(source("components/dashboard-shell.tsx"), /trapDrawerFocus/);
    assert.match(source("components/dashboard-shell.tsx"), /document\.body\.style\.overflow = "hidden"/);
  });

  it("uses progressive disclosure and a Basic default for complex tools", () => {
    const grants = source("components/grant-finder.tsx");
    assert.match(grants, /"invention" \| "applicant" \| "matches" \| "history"/);
    assert.match(grants, /useState<GrantFormMode>\("basic"\)/);
    assert.match(grants, /formMode === "advanced"/);
    assert.match(source("components/manufacturing-input-profile.tsx"), /useState<"basic" \| "advanced">\("basic"\)/);
    assert.match(source("components/trademark-search-workspace.tsx"), /"GUIDED" \| "ADVANCED"/);
  });
});
