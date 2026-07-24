"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  WORKSPACE_GROUP_LABELS,
  WORKSPACE_PANEL_SECTIONS,
  adjacentWorkspaceSection,
  resolveWorkspaceSection,
  workspaceSectionUrl,
  type WorkspaceGroupId,
  type WorkspaceSectionId,
  type WorkspaceSectionState,
} from "@/lib/patents/invention-workspace";
import type { WorkflowStatus } from "@/lib/patents/workflow-state";

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  NOT_STARTED: "Not started",
  ACTION_REQUIRED: "Action required",
  IN_PROGRESS: "In progress",
  COMPLETED: "Complete",
  OUTDATED: "Outdated",
  ERROR: "Error",
};
const STATUS_ICONS: Record<WorkflowStatus, string> = {
  NOT_STARTED: "○",
  ACTION_REQUIRED: "!",
  IN_PROGRESS: "◌",
  COMPLETED: "✓",
  OUTDATED: "↺",
  ERROR: "×",
};

type WorkspaceNavigateDetail = { section?: WorkspaceSectionId; focusSelector?: string };

export function InventionWorkspace({
  sections,
  defaultSection,
  completionPercentage,
  overview,
  details,
  images,
  technicalReview,
  priorArt,
  overlap,
  drafting,
  activity,
}: {
  sections: WorkspaceSectionState[];
  defaultSection: WorkspaceSectionId;
  completionPercentage: number;
  overview: ReactNode;
  details: ReactNode;
  images: ReactNode;
  technicalReview: ReactNode;
  priorArt: ReactNode;
  overlap: ReactNode;
  drafting: ReactNode;
  activity: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const requestedSection = searchParams.get("section");
  const activeSection = resolveWorkspaceSection(requestedSection, defaultSection);
  const activeState = sections.find((section) => section.id === activeSection)!;
  const previous = adjacentWorkspaceSection(activeSection, -1);
  const next = adjacentWorkspaceSection(activeSection, 1);
  const panels = [overview, details, images, technicalReview, priorArt, overlap, drafting, activity];
  const mobileSelectRef = useRef<HTMLSelectElement>(null);

  function navigate(section: WorkspaceSectionId, replace = false, focusSelector?: string) {
    const url = `${pathname}${workspaceSectionUrl(queryString, section)}`;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
    window.requestAnimationFrame(() => {
      const target = focusSelector
        ? document.querySelector<HTMLElement>(focusSelector)
        : document.querySelector<HTMLElement>(`[data-workspace-panel][data-active-section="${section}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusSelector) window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    });
  }

  useEffect(() => {
    if (requestedSection !== activeSection) {
      const url = `${pathname}${workspaceSectionUrl(queryString, activeSection)}`;
      window.history.replaceState(null, "", url);
    }
  }, [activeSection, pathname, queryString, requestedSection]);

  useEffect(() => {
    function handleNavigation(event: Event) {
      const detail = (event as CustomEvent<WorkspaceNavigateDetail>).detail;
      if (!detail?.section) return;
      navigate(detail.section, false, detail.focusSelector);
    }
    window.addEventListener("inventra:workspace-navigate", handleNavigation);
    return () => window.removeEventListener("inventra:workspace-navigate", handleNavigation);
  });

  const grouped = (["setup", "technical", "prior-art", "drafting", "history"] as WorkspaceGroupId[])
    .map((group) => ({ group, sections: sections.filter((section) => section.group === group) }));

  return <div className="invention-workspace">
    <aside className="workspace-index">
      <header><span>WORKFLOW INDEX</span><strong>{completionPercentage}% complete</strong><i><b style={{ width: `${completionPercentage}%` }} /></i></header>
      <nav aria-label="Invention workflow sections">
        {grouped.map(({ group, sections: groupSections }) => <section key={group}>
          <h2>{WORKSPACE_GROUP_LABELS[group]}</h2>
          <ul>{groupSections.map((section) => <li key={section.id}><button type="button" aria-current={section.id === activeSection ? "page" : undefined} onClick={() => navigate(section.id)}><span className="workspace-nav-icon" aria-hidden="true">{STATUS_ICONS[section.status]}</span><span><strong>{section.label}</strong><small>{STATUS_LABELS[section.status]}</small></span></button></li>)}</ul>
        </section>)}
      </nav>
    </aside>

    <main className="workspace-main">
      <div className="workspace-mobile-selector">
        <button type="button" className="workspace-current-section" aria-label={`Current section: ${activeState.label}. Choose another section.`} onClick={() => mobileSelectRef.current?.focus()}><span>Current section</span><strong>{activeState.label}</strong></button>
        <label><span>Choose workflow section</span><select ref={mobileSelectRef} value={activeSection} onChange={(event) => navigate(event.target.value as WorkspaceSectionId)}>{sections.map((section) => <option value={section.id} key={section.id}>{section.label} — {STATUS_LABELS[section.status]}</option>)}</select></label>
      </div>

      {WORKSPACE_PANEL_SECTIONS.map((panelSections, index) => {
        const visible = panelSections.includes(activeSection);
        const panelState = visible ? activeState : sections.find((section) => panelSections.includes(section.id))!;
        return <section
          className={visible ? "workspace-panel workspace-active-panel" : "workspace-panel"}
          data-workspace-panel
          data-active-section={activeSection}
          hidden={!visible}
          aria-labelledby={visible ? `workspace-heading-${activeSection}` : undefined}
          key={`workspace-panel-${index + 1}`}
        >
          <header className="workspace-panel-header">
            <div><span className="eyebrow">{WORKSPACE_GROUP_LABELS[panelState.group]}</span><h2 id={visible ? `workspace-heading-${activeSection}` : undefined}>{panelState.label}</h2><p>{panelState.shortDescription}</p></div>
            <div><span className={`workspace-panel-status status-${panelState.status.toLowerCase()}`}>{STATUS_ICONS[panelState.status]} {STATUS_LABELS[panelState.status]}</span>{panelState.version !== null && <small>Feature set v{panelState.version}</small>}</div>
          </header>
          {panelState.lockedMessage && <div className="workspace-locked-note" role="note"><span aria-hidden="true">○</span><p><strong>Prerequisite required</strong>{panelState.lockedMessage}</p></div>}
          <div className="workspace-panel-content">{panels[index]}</div>
          <nav className="workspace-section-pagination" aria-label="Previous and next workflow sections">
            {previous ? <button type="button" onClick={() => navigate(previous)}><span>← Previous</span><strong>{sections.find((section) => section.id === previous)?.label}</strong></button> : <span />}
            {next ? <button type="button" onClick={() => navigate(next)}><span>Next →</span><strong>{sections.find((section) => section.id === next)?.label}</strong></button> : <span />}
          </nav>
        </section>;
      })}
    </main>
  </div>;
}
