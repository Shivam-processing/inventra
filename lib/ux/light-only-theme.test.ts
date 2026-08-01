import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = (path: string) => readFileSync(join(root, path), "utf8");

function collectSources(directory: string): string {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSources(path);
    return [".css", ".ts", ".tsx"].includes(extname(entry.name)) && !entry.name.endsWith(".test.ts") ? source(path) : "";
  }).join("\n");
}

describe("Workshop light-only appearance", () => {
  it("removes theme controls, providers and persisted-theme readers", () => {
    for (const path of ["lib/theme.ts", "components/theme-provider.tsx", "components/theme-switcher.tsx"]) {
      assert.equal(existsSync(join(root, path)), false);
    }
    const application = `${collectSources("app")}\n${collectSources("components")}\n${collectSources("lib")}`;
    assert.doesNotMatch(application, /\b(?:ThemeProvider|ThemeSwitcher|AppearanceProvider|useTheme|setTheme|resolvedTheme)\b/);
    assert.doesNotMatch(application, /inventra_theme|prefers-color-scheme:\s*dark|color-scheme:\s*dark|(?:^|[\s"'`])dark:/m);
  });

  it("keeps the root layout independent of cookies, storage and system appearance", () => {
    const layout = source("app/layout.tsx");
    assert.doesNotMatch(layout, /cookies|localStorage|data-theme|data-appearance|className=.*dark/);
    assert.match(layout, /<html[\s\S]*lang=\{config\.htmlLang\}/);
  });

  it("keeps Workshop tokens and light component surfaces", () => {
    const css = source("app/globals.css");
    for (const token of [
      "--page-bg: #FEFCF9",
      "--elevated-bg: #F7F4F0",
      "--card-bg: #FFFFFF",
      "--sidebar-bg: #F0EBE4",
      "--text-primary: #232019",
      "--text-body: #504A40",
      "--primary: #D4603A",
    ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(css, /:where\(\.site-page,\.lab-page,\.lab-main,\.auth-page,\.dashboard-shell\)/);
    assert.match(css, /:where\(input,textarea,select\)[^{]*\{[^}]*background: var\(--input-bg\) !important/);
  });

  it("removes appearance selectors from desktop, mobile, auth and settings UI", () => {
    for (const path of ["components/site-header.tsx", "components/dashboard-shell.tsx", "app/(auth)/layout.tsx", "app/dashboard/settings/page.tsx"]) {
      assert.doesNotMatch(source(path), /ThemeSwitcher|Appearance|Light mode|Dark mode/);
    }
    assert.match(source("app/dashboard/settings/page.tsx"), /Website language/);
  });

  it("keeps the patent landscape interactive and its dark canvas isolated", () => {
    const landscape = source("components/patent-landscape.tsx");
    assert.match(landscape, /PatentNetworkGraph/);
    assert.match(landscape, /PatentLandscapeTimeline/);
    assert.match(landscape, /Export current view as PNG/);
    assert.match(landscape, /className="landscape-stage"/);
    assert.doesNotMatch(landscape, /color-scheme:\s*dark/);
  });
});
