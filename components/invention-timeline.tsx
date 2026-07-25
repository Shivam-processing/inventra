"use client";

import { useMemo, useState } from "react";
import {
  filterTimelineEvents,
  sortTimelineEvents,
  type InventionTimelineEvent,
  type TimelineFilter,
  type TimelineSort,
} from "@/lib/patents/invention-timeline";
import type { WorkspaceSectionId } from "@/lib/patents/invention-workspace";

const FILTERS: Array<{ value: TimelineFilter; label: string }> = [
  { value: "ALL", label: "All activity" },
  { value: "FEATURES", label: "Features" },
  { value: "SEARCHES", label: "Patent searches" },
  { value: "REPORTS", label: "Overlap reports" },
  { value: "DRAFTS", label: "Patent drafts" },
  { value: "ERRORS", label: "Errors" },
];
const OUTCOME_LABELS = { COMPLETED: "Completed", FAILED: "Failed", IN_PROGRESS: "In progress" } as const;
const STATE_LABELS = { CURRENT: "Current", HISTORICAL: "Historical", SUPERSEDED: "Superseded", OUTDATED: "Outdated" } as const;
const CATEGORY_LABELS = { DETAILS: "Invention", FEATURES: "Features", SEARCHES: "Patent search", REPORTS: "Overlap report", DRAFTS: "Patent draft" } as const;
const ACTION_LABELS = {
  "#step-details": "View invention details",
  "#step-features": "View feature editor",
  "#step-patent-search": "View patent search",
  "#step-report": "View overlap report",
  "#step-draft": "View patent draft",
} as const;
const ACTION_SECTIONS: Record<keyof typeof ACTION_LABELS, WorkspaceSectionId> = {
  "#step-details": "invention-details",
  "#step-features": "feature-review",
  "#step-patent-search": "patent-search",
  "#step-report": "overlap-report",
  "#step-draft": "patent-draft",
};

const timelineTimestampFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatTimelineTimestamp(value: string | null) {
  if (!value) return "Date unavailable";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return "Date unavailable";
    return timelineTimestampFormatter.format(date);
  } catch {
    return "Date unavailable";
  }
}

function validTimestamp(value: string | null) {
  return value && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

function TimelineEvent({ event, compact }: { event: InventionTimelineEvent; compact: boolean }) {
  return <li className={`timeline-event timeline-event-${event.outcome.toLowerCase()} timeline-state-${event.recordState.toLowerCase()}`}>
    <div className="timeline-event-time"><time dateTime={validTimestamp(event.timestamp)}>{formatTimelineTimestamp(event.timestamp)}</time></div>
    <span className="timeline-event-marker" aria-hidden="true" />
    <article>
      <header><div><span className="timeline-category">{CATEGORY_LABELS[event.category]}</span><h3>{event.title}</h3></div><div className="timeline-statuses"><span>{OUTCOME_LABELS[event.outcome]}</span><span>{STATE_LABELS[event.recordState]}</span></div></header>
      {!compact && <p>{event.description}</p>}
      <footer>
        <div><span>{CATEGORY_LABELS[event.category]}</span>{event.featureSetVersion !== undefined && <span>Feature set v{event.featureSetVersion}</span>}{event.draftVersion !== undefined && <span>Draft v{event.draftVersion}</span>}</div>
        {event.href && <a href={`?section=${ACTION_SECTIONS[event.href]}`} onClick={(clickEvent) => {
          clickEvent.preventDefault();
          window.dispatchEvent(new CustomEvent("inventra:workspace-navigate", { detail: { section: ACTION_SECTIONS[event.href!] } }));
        }}>{ACTION_LABELS[event.href]} <span aria-hidden="true">↓</span></a>}
      </footer>
    </article>
  </li>;
}

export function InventionTimeline({ events, loadError }: { events: InventionTimelineEvent[]; loadError?: string }) {
  const [filter, setFilter] = useState<TimelineFilter>("ALL");
  const [sort, setSort] = useState<TimelineSort>("newest");
  const [compact, setCompact] = useState(true);
  const visibleEvents = useMemo(
    () => sortTimelineEvents(filterTimelineEvents(events, filter), sort),
    [events, filter, sort],
  );

  return <section className={compact ? "invention-timeline timeline-compact" : "invention-timeline"} aria-labelledby="invention-timeline-title">
    <header className="timeline-heading">
      <div><span className="timeline-heading-icon" aria-hidden="true">◷</span><div><span className="eyebrow">ACTIVITY HISTORY</span><h2 id="invention-timeline-title">Invention timeline</h2><p>Stored workflow activity across feature versions and downstream records.</p></div></div>
      <span className="timeline-count" role="status">{visibleEvents.length} event{visibleEvents.length === 1 ? "" : "s"}</span>
    </header>

    <div className="timeline-controls">
      <div className="timeline-filters" role="group" aria-label="Filter invention timeline">
        {FILTERS.map((option) => <button type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)} key={option.value}>{option.label}</button>)}
      </div>
      <div className="timeline-view-controls">
        <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as TimelineSort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        <div role="group" aria-label="Timeline detail level"><button type="button" aria-pressed={compact} onClick={() => setCompact(true)}>Compact</button><button type="button" aria-pressed={!compact} onClick={() => setCompact(false)}>Expanded</button></div>
      </div>
    </div>

    {loadError && <div className="timeline-load-error" role="alert">{loadError}</div>}
    {events.length === 0 && !loadError && <div className="timeline-empty"><span aria-hidden="true">◷</span><div><strong>No workflow activity yet</strong><p>Timeline events will appear as this invention moves through the workflow.</p></div></div>}
    {events.length > 0 && visibleEvents.length === 0 && <div className="timeline-empty"><span aria-hidden="true">⌕</span><div><strong>No activity matches this filter</strong><p>Choose another activity category to view stored timeline events.</p></div></div>}
    {visibleEvents.length > 0 && <ol className="timeline-list">{visibleEvents.map((event) => <TimelineEvent event={event} compact={compact} key={event.id} />)}</ol>}
  </section>;
}

export function InventionTimelineLoading() {
  return <section className="invention-timeline timeline-loading" aria-labelledby="invention-timeline-loading-title">
    <header className="timeline-heading"><div><span className="timeline-heading-icon" aria-hidden="true">◷</span><div><span className="eyebrow">ACTIVITY HISTORY</span><h2 id="invention-timeline-loading-title">Invention timeline</h2><p>Loading stored workflow activity…</p></div></div></header>
    <div className="timeline-loading-row" role="status"><span className="spinner" aria-hidden="true" /><p>Preparing the invention history.</p></div>
  </section>;
}
