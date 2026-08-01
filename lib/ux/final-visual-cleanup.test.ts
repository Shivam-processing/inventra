import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("final Workshop visual cleanup", () => {
  const css = source("app/globals.css");

  it("removes floating mascots from authenticated application styles", () => {
    assert.doesNotMatch(css, /\.floating-mascot|\.global-mascot|\.assistant-orb|\.codex-robot/);
    for (const path of [
      "app/dashboard/layout.tsx",
      "components/dashboard-shell.tsx",
      "components/invention-workspace.tsx",
      "components/patent-comparison-matrix.tsx",
      "components/manufacturing-finder.tsx",
      "components/patent-draft.tsx",
    ]) {
      assert.doesNotMatch(source(path), /mascot|floating assistant|assistant-orb|codex-robot/i);
    }
  });

  it("keeps expanded sidebar descriptions readable and hides them on narrow screens", () => {
    const finalStyles = css.split("/* Final Workshop consistency:")[1] ?? "";
    assert.match(finalStyles, /\.dashboard-sidebar nav \.sidebar-nav-group a small\s*\{[\s\S]*?font-size:\s*13px;[\s\S]*?line-height:\s*18px;[\s\S]*?white-space:\s*normal;[\s\S]*?text-overflow:\s*clip;/);
    assert.match(finalStyles, /@media \(max-width: 780px\)[\s\S]*?\.dashboard-sidebar nav \.sidebar-nav-group a small\s*\{\s*display:\s*none;/);
    assert.match(finalStyles, /a\.active\s*\{[\s\S]*?border-left-color:\s*var\(--primary\);[\s\S]*?box-shadow:\s*none !important;/);
  });

  it("uses a light semantic information notice in the patent workspace", () => {
    assert.match(css, /\.workflow-legal-notice\s*\{[^}]*background:\s*var\(--info-subtle\)/);
    assert.match(css, /\.workflow-legal-notice p\s*\{[^}]*font-size:\s*15px/);
    assert.doesNotMatch(css.match(/\.workflow-legal-notice\s*\{[^}]*\}/g)?.at(-1) ?? "", /#0[58]|rgba\((?:5|8|13),/);
  });

  it("normalises draft UI typography, metadata wrapping, status, and disabled actions", () => {
    const draft = source("components/patent-draft.tsx");
    assert.match(draft, /draft-provider-meta">Mock patent draft provider/);
    assert.match(draft, /draft-section-nav[^>]*[\s\S]*<span>Draft sections<\/span>/);
    assert.match(css, /\.invention-detail-page \.patent-draft-toolbar h2,[\s\S]*font-family:\s*var\(--font-dm-sans\)/);
    assert.match(css, /\.invention-detail-page \.draft-meta\s*\{[^}]*flex-wrap:\s*wrap/);
    assert.doesNotMatch(css.match(/\.invention-detail-page \.draft-meta\s*\{[^}]*\}/)?.[0] ?? "", /position:\s*absolute/);
    assert.match(css, /\.draft-status-completed\s*\{[^}]*var\(--success-subtle\)/);
    assert.match(css, /:disabled\s*\{[^}]*background:\s*var\(--elevated-bg\)[^}]*color:\s*var\(--text-secondary\)[^}]*opacity:\s*1/);
  });

  it("uses the three-state Workshop manufacturing stepper", () => {
    const finder = source("components/manufacturing-finder.tsx");
    assert.match(finder, /currentFlowStep/);
    assert.match(finder, /"completed"[\s\S]*"current"[\s\S]*"future"/);
    assert.doesNotMatch(finder, /<span>Step \{index \+ 1\}<\/span>/);
    assert.match(css, /\.manufacturing-flow\s*\{[^}]*background:\s*var\(--card-bg\)/);
    assert.match(css, /\.manufacturing-flow li\.current\s*\{[^}]*background:\s*var\(--primary-subtle\)/);
    assert.match(css, /\.manufacturing-flow li\.completed\s*\{[^}]*background:\s*var\(--success-subtle\)/);
  });

  it("keeps invention selection cards interactive and visibly selected", () => {
    const finder = source("components/manufacturing-finder.tsx");
    assert.match(finder, /role="option" aria-selected=\{selectedId === item\.id\}/);
    assert.match(finder, /<i aria-hidden="true">✓<\/i>/);
    assert.match(css, /\.manufacturing-invention-list button\s*\{[^}]*background:\s*var\(--card-bg\) !important/);
    assert.match(css, /button\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--primary-subtle\) !important/);
  });

  it("uses a compact manufacturing empty state and prevents page overflow", () => {
    assert.match(source("lib/i18n/messages/en.ts"), /Select an invention to continue/);
    assert.match(source("lib/i18n/messages/en.ts"), /Choose one of your inventions above to review manufacturing assumptions and generate a plan\./);
    assert.match(css, /\.manufacturing-empty\s*\{[^}]*min-height:\s*0[^}]*padding:\s*42px 24px/);
    assert.match(css, /\.invention-detail-page,[\s\S]*\.manufacturing-page\s*\{[^}]*overflow-x:\s*clip/);
  });

  it("uses Workshop comparison typography, cards, controls, and the shared grouped workflow", () => {
    const matrix = source("components/patent-comparison-matrix.tsx");
    const workspace = source("components/invention-workspace.tsx");
    const finalStyles = css.split("/* Final Workshop consistency:")[1] ?? "";
    assert.match(matrix, /Preliminary feature comparison/);
    assert.doesNotMatch(matrix, /DETERMINISTIC COMPARISON/);
    assert.match(matrix, /aria-label=\{`\$\{selected \? "Selected" : "Not selected"\}/);
    assert.match(finalStyles, /\.patent-matrix-heading h2\s*\{[\s\S]*?font-family:\s*var\(--font-dm-sans\)/);
    assert.match(finalStyles, /\.matrix-patent-selector label\s*\{[\s\S]*?background:\s*var\(--card-bg\)/);
    assert.match(finalStyles, /\.matrix-patent-selector label\.selected\s*\{[\s\S]*?background:\s*var\(--primary-subtle\)/);
    assert.match(finalStyles, /\.matrix-selection-toolbar button\s*\{[\s\S]*?background:\s*var\(--card-bg\);[\s\S]*?color:\s*var\(--text-primary\)/);
    assert.match(workspace, /className={`phase-\$\{phaseStatus\}`}/);
    assert.doesNotMatch(workspace, /WORKFLOW INDEX|className="workspace-index"/);
  });

  it("uses application typography and no duplicate step badge in manufacturing", () => {
    const finder = source("components/manufacturing-finder.tsx");
    const messages = source("lib/i18n/messages/en.ts");
    const finalStyles = css.split("/* Final Workshop consistency:")[1] ?? "";
    assert.match(messages, /"manufacturing\.eyebrow": "Manufacturing planning"/);
    assert.doesNotMatch(finder, /<span>Step 1<\/span>/);
    assert.match(finalStyles, /\.manufacturing-hero h1\s*\{[\s\S]*?font-family:\s*var\(--font-dm-sans\)[\s\S]*?font-size:\s*clamp\(28px, 3vw, 34px\)/);
    assert.doesNotMatch(finder, /(?:cyan|#22d3ee|#38bdf8|#67e8f9)/i);
    assert.doesNotMatch(finder, /SOURCING PLANNING LAB|BUILD PLANNING LAB/);
  });

  it("contains no old dark utility classes in the cleaned components", () => {
    const cleaned = ["components/invention-workspace.tsx", "components/patent-draft.tsx", "components/manufacturing-finder.tsx"].map(source).join("\n");
    assert.doesNotMatch(cleaned, /\b(?:bg-(?:slate|gray|zinc|neutral)-(?:500|600|700|800|900)|text-(?:slate|gray)-\d+)\b/);
  });
});
