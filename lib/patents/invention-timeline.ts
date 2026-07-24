export type TimelineCategory = "DETAILS" | "FEATURES" | "SEARCHES" | "REPORTS" | "DRAFTS";
export type TimelineFilter = "ALL" | TimelineCategory | "ERRORS";
export type TimelineOutcome = "COMPLETED" | "FAILED" | "IN_PROGRESS";
export type TimelineRecordState = "CURRENT" | "HISTORICAL" | "SUPERSEDED" | "OUTDATED";
export type TimelineSort = "newest" | "oldest";

export type InventionTimelineEvent = {
  id: string;
  category: TimelineCategory;
  title: string;
  description: string;
  timestamp: string | null;
  timestampMs: number | null;
  outcome: TimelineOutcome;
  recordState: TimelineRecordState;
  featureSetVersion?: number;
  draftVersion?: number;
  href?: "#step-details" | "#step-features" | "#step-patent-search" | "#step-report" | "#step-draft";
};

type InventionRecord = {
  createdAt: string | null;
  updatedAt: string | null;
  aiStatus: string | null;
  featureSetVersion: number;
  approvedFeatureCount: number;
  clarification: unknown;
};

type SearchRecord = {
  id: string;
  status: string;
  featureSetVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type ReportRecord = {
  id: string;
  patentSearchId: string;
  status: string;
  featureSetVersion: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type DraftRecord = {
  id: string;
  patentSearchId: string;
  overlapReportId: string;
  status: string;
  featureSetVersion: number;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  acknowledgementAt: string | null;
  edited: boolean;
};

export type InventionTimelineInput = {
  invention: InventionRecord | null;
  searches: SearchRecord[];
  reports: ReportRecord[];
  drafts: DraftRecord[];
};

function timestamp(value: string | null | undefined) {
  if (!value) return { timestamp: null, timestampMs: null };
  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs)
    ? { timestamp: new Date(timestampMs).toISOString(), timestampMs }
    : { timestamp: null, timestampMs: null };
}

function event(
  id: string,
  values: Omit<InventionTimelineEvent, "id" | "timestamp" | "timestampMs"> & { at: string | null },
): InventionTimelineEvent {
  const { at, ...rest } = values;
  return { id, ...rest, ...timestamp(at) };
}

function newest<T extends { createdAt: string | null }>(records: T[], predicate: (record: T) => boolean) {
  return records
    .filter(predicate)
    .map((record, index) => ({ record, index, time: timestamp(record.createdAt).timestampMs ?? Number.NEGATIVE_INFINITY }))
    .sort((left, right) => right.time - left.time || left.index - right.index)[0]?.record ?? null;
}

function finalOutcome(status: string): TimelineOutcome {
  if (status === "FAILED") return "FAILED";
  if (status === "PROCESSING") return "IN_PROGRESS";
  return "COMPLETED";
}

function recordState(featureVersion: number, currentFeatureVersion: number, current: boolean): TimelineRecordState {
  if (featureVersion !== currentFeatureVersion) return "OUTDATED";
  return current ? "CURRENT" : "SUPERSEDED";
}

function clarificationCompletion(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  return source.status === "COMPLETED" && typeof source.updatedAt === "string" ? source.updatedAt : null;
}

function differentTimes(left: string | null, right: string | null) {
  const leftTime = timestamp(left).timestampMs;
  const rightTime = timestamp(right).timestampMs;
  return leftTime !== null && rightTime !== null && Math.abs(leftTime - rightTime) >= 1000;
}

export function buildInventionTimeline(input: InventionTimelineInput): InventionTimelineEvent[] {
  if (!input.invention) return [];
  const invention = input.invention;
  const currentVersion = invention.featureSetVersion;
  const currentSearch = newest(input.searches, (search) => search.featureSetVersion === currentVersion);
  const currentCompletedSearch = newest(input.searches, (search) => search.featureSetVersion === currentVersion && search.status === "COMPLETED");
  const currentReport = currentCompletedSearch
    ? newest(input.reports, (report) => report.featureSetVersion === currentVersion && report.patentSearchId === currentCompletedSearch.id)
    : null;
  const currentCompletedReport = currentCompletedSearch
    ? newest(input.reports, (report) => report.featureSetVersion === currentVersion && report.patentSearchId === currentCompletedSearch.id && report.status === "COMPLETED")
    : null;
  const currentDraft = currentCompletedSearch && currentCompletedReport
    ? newest(input.drafts, (draft) => draft.featureSetVersion === currentVersion && draft.patentSearchId === currentCompletedSearch.id && draft.overlapReportId === currentCompletedReport.id)
    : null;
  const events: InventionTimelineEvent[] = [];

  events.push(event("invention-created", {
    category: "DETAILS",
    title: "Invention created",
    description: "The private invention case was added to this workspace.",
    at: invention.createdAt,
    outcome: "COMPLETED",
    recordState: "HISTORICAL",
    href: "#step-details",
  }));

  if (differentTimes(invention.createdAt, invention.updatedAt)) {
    events.push(event("invention-updated", {
      category: "DETAILS",
      title: "Invention details updated",
      description: "The invention record was last updated; this timestamp may also include workflow-related changes.",
      at: invention.updatedAt,
      outcome: "COMPLETED",
      recordState: "CURRENT",
      href: "#step-details",
    }));
  }

  const clarificationAt = clarificationCompletion(invention.clarification);
  if (clarificationAt) {
    events.push(event("clarification-completed", {
      category: "FEATURES",
      title: "Clarification answers completed",
      description: "The stored clarification questions were answered or intentionally skipped.",
      at: clarificationAt,
      outcome: "COMPLETED",
      recordState: "CURRENT",
      featureSetVersion: currentVersion,
      href: "#step-features",
    }));
  }

  if (invention.approvedFeatureCount > 0) {
    events.push(event("features-saved", {
      category: "FEATURES",
      title: "Feature list saved",
      description: `${invention.approvedFeatureCount} technical feature${invention.approvedFeatureCount === 1 ? " was" : "s were"} stored for review.`,
      at: invention.updatedAt,
      outcome: "COMPLETED",
      recordState: "CURRENT",
      featureSetVersion: currentVersion,
      href: "#step-features",
    }));
  }

  if (invention.aiStatus === "APPROVED" && invention.approvedFeatureCount > 0) {
    events.push(event("features-approved", {
      category: "FEATURES",
      title: "Feature set approved",
      description: "The current feature list was approved for downstream patent work.",
      at: invention.updatedAt,
      outcome: "COMPLETED",
      recordState: "CURRENT",
      featureSetVersion: currentVersion,
      href: "#step-features",
    }));
  }

  input.searches.forEach((search, index) => {
    const state = recordState(search.featureSetVersion, currentVersion, search.id === currentSearch?.id);
    events.push(event(`search-${index + 1}-started`, {
      category: "SEARCHES",
      title: "Patent search started",
      description: "A prior-art search was started using the approved features available at that time.",
      at: search.createdAt,
      outcome: "IN_PROGRESS",
      recordState: state,
      featureSetVersion: search.featureSetVersion,
      href: "#step-patent-search",
    }));
    if (search.status === "COMPLETED" || search.status === "FAILED") {
      events.push(event(`search-${index + 1}-finished`, {
        category: "SEARCHES",
        title: search.status === "COMPLETED" ? "Patent search completed" : "Patent search failed",
        description: search.status === "COMPLETED" ? "The search results were stored for review." : "The search attempt ended without completed results.",
        at: search.updatedAt,
        outcome: finalOutcome(search.status),
        recordState: state,
        featureSetVersion: search.featureSetVersion,
        href: "#step-patent-search",
      }));
    }
  });

  input.reports.forEach((report, index) => {
    const belongsToCurrentSearch = report.patentSearchId === currentCompletedSearch?.id;
    const state = report.featureSetVersion !== currentVersion || !belongsToCurrentSearch
      ? "OUTDATED"
      : recordState(report.featureSetVersion, currentVersion, report.id === currentReport?.id);
    events.push(event(`report-${index + 1}-started`, {
      category: "REPORTS",
      title: "Overlap report started",
      description: "Deterministic feature comparison began for the related patent search.",
      at: report.createdAt,
      outcome: "IN_PROGRESS",
      recordState: state,
      featureSetVersion: report.featureSetVersion,
      href: "#step-report",
    }));
    if (report.status === "COMPLETED" || report.status === "FAILED") {
      events.push(event(`report-${index + 1}-finished`, {
        category: "REPORTS",
        title: report.status === "COMPLETED" ? "Overlap report generated" : "Overlap report failed",
        description: report.status === "COMPLETED" ? "The deterministic feature-overlap assessment was stored." : "The overlap assessment could not be completed.",
        at: report.updatedAt,
        outcome: finalOutcome(report.status),
        recordState: state,
        featureSetVersion: report.featureSetVersion,
        href: "#step-report",
      }));
    }
  });

  input.drafts.forEach((draft, index) => {
    const belongsToCurrentChain = draft.patentSearchId === currentCompletedSearch?.id && draft.overlapReportId === currentCompletedReport?.id;
    const state = draft.featureSetVersion !== currentVersion || !belongsToCurrentChain
      ? "OUTDATED"
      : recordState(draft.featureSetVersion, currentVersion, draft.id === currentDraft?.id);

    if (draft.status === "PROCESSING") {
      events.push(event(`draft-${index + 1}-started`, {
        category: "DRAFTS",
        title: "Patent draft generation started",
        description: "A preliminary patent draft generation request is in progress.",
        at: draft.acknowledgementAt ?? draft.updatedAt ?? draft.createdAt,
        outcome: "IN_PROGRESS",
        recordState: state,
        featureSetVersion: draft.featureSetVersion,
        draftVersion: draft.version,
        href: "#step-draft",
      }));
      return;
    }

    if (draft.status === "FAILED") {
      events.push(event(`draft-${index + 1}-failed`, {
        category: "DRAFTS",
        title: "Patent draft generation failed",
        description: "The draft generation request ended without a completed draft.",
        at: draft.updatedAt,
        outcome: "FAILED",
        recordState: state,
        featureSetVersion: draft.featureSetVersion,
        draftVersion: draft.version,
        href: "#step-draft",
      }));
      return;
    }

    events.push(event(`draft-${index + 1}-generated`, {
      category: "DRAFTS",
      title: "Patent draft generated",
      description: "The first stored draft record for this search and report chain was created.",
      at: draft.createdAt,
      outcome: "COMPLETED",
      recordState: state,
      featureSetVersion: draft.featureSetVersion,
      draftVersion: 1,
      href: "#step-draft",
    }));

    if (draft.version > 1) {
      events.push(event(`draft-${index + 1}-version`, {
        category: "DRAFTS",
        title: `New draft version ${draft.version} created`,
        description: "A newer saved draft revision replaced the previous editable version for this source chain.",
        at: draft.updatedAt,
        outcome: "COMPLETED",
        recordState: state,
        featureSetVersion: draft.featureSetVersion,
        draftVersion: draft.version,
        href: "#step-draft",
      }));
    }

    if (draft.edited) {
      events.push(event(`draft-${index + 1}-edited`, {
        category: "DRAFTS",
        title: "Patent draft edited and saved",
        description: "The editable draft differs from its originally generated sections and was saved.",
        at: draft.updatedAt,
        outcome: "COMPLETED",
        recordState: state,
        featureSetVersion: draft.featureSetVersion,
        draftVersion: draft.version,
        href: "#step-draft",
      }));
    }
  });

  return sortTimelineEvents(events, "newest");
}

export function sortTimelineEvents(events: InventionTimelineEvent[], direction: TimelineSort) {
  const multiplier = direction === "newest" ? -1 : 1;
  return [...events].sort((left, right) => {
    if (left.timestampMs === null && right.timestampMs === null) return left.id.localeCompare(right.id);
    if (left.timestampMs === null) return 1;
    if (right.timestampMs === null) return -1;
    return (left.timestampMs - right.timestampMs) * multiplier || left.id.localeCompare(right.id);
  });
}

export function filterTimelineEvents(events: InventionTimelineEvent[], filter: TimelineFilter) {
  if (filter === "ALL") return [...events];
  if (filter === "ERRORS") return events.filter((event) => event.outcome === "FAILED");
  return events.filter((event) => event.category === filter);
}
