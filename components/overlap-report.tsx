"use client";

import { useActionState } from "react";
import {
  generateOverlapReport,
  type OverlapReportActionState,
} from "@/app/dashboard/inventions/[id]/overlap-report-actions";
import type {
  FeatureOverlapMatch,
  OverlapMatchType,
  OverlapSummary,
  OverlapSummaryType,
} from "@/lib/patents/overlap-types";

export type OverlapReportRecord = {
  status: string;
  featureSetVersion: number;
  summary: unknown;
  featureMatches: unknown;
  errorMessage: string | null;
};

const initialState: OverlapReportActionState = {};
const summaryLabels: Record<OverlapSummaryType, string> = {
  HIGH_CONFLICT: "High conflict",
  PARTIAL_OVERLAP: "Partial overlap",
  LOW_OVERLAP: "Low overlap",
  INSUFFICIENT_INFORMATION: "Insufficient information",
};
const matchLabels: Record<OverlapMatchType, string> = {
  FULL: "Full",
  PARTIAL: "Partial",
  NOT_FOUND: "Not found",
  UNCERTAIN: "Uncertain",
};

function summary(value: unknown): OverlapSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const classification = source.classification;
  if (classification !== "HIGH_CONFLICT" && classification !== "PARTIAL_OVERLAP" && classification !== "LOW_OVERLAP" && classification !== "INSUFFICIENT_INFORMATION") return null;
  return {
    classification,
    fullMatches: typeof source.fullMatches === "number" ? source.fullMatches : 0,
    partialMatches: typeof source.partialMatches === "number" ? source.partialMatches : 0,
    notFound: typeof source.notFound === "number" ? source.notFound : 0,
    uncertain: typeof source.uncertain === "number" ? source.uncertain : 0,
  };
}

function matches(value: unknown): FeatureOverlapMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const matchType = source.matchType;
    if (typeof source.feature !== "string" || typeof source.explanation !== "string" || (matchType !== "FULL" && matchType !== "PARTIAL" && matchType !== "NOT_FOUND" && matchType !== "UNCERTAIN")) return [];
    return [{
      feature: source.feature,
      matchedPatentTitle: typeof source.matchedPatentTitle === "string" ? source.matchedPatentTitle : null,
      publicationNumber: typeof source.publicationNumber === "string" ? source.publicationNumber : null,
      matchType,
      matchedKeywords: Array.isArray(source.matchedKeywords) ? source.matchedKeywords.filter((word): word is string => typeof word === "string") : [],
      explanation: source.explanation,
    }];
  });
}

function ComparisonTable({ featureMatches }: { featureMatches: FeatureOverlapMatch[] }) {
  return <div className="overlap-table-wrap"><table className="overlap-table">
    <thead><tr><th>Approved feature</th><th>Closest patent</th><th>Match</th><th>Matched keywords</th><th>Assessment</th></tr></thead>
    <tbody>{featureMatches.map((match, index) => <tr key={`${match.feature}-${index}`}>
      <td data-label="Approved feature">{match.feature}</td>
      <td data-label="Closest patent"><strong>{match.matchedPatentTitle ?? "No matching patent"}</strong><small>{match.publicationNumber ?? "—"}</small></td>
      <td data-label="Match"><span className={`overlap-match overlap-${match.matchType.toLowerCase()}`}>{matchLabels[match.matchType]}</span></td>
      <td data-label="Matched keywords"><div className="overlap-keywords">{match.matchedKeywords.length ? match.matchedKeywords.map((word) => <code key={word}>{word}</code>) : <span>None</span>}</div></td>
      <td data-label="Assessment">{match.explanation}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function OverlapReportPanel({
  inventionId,
  featuresApproved,
  hasCompletedSearch,
  report,
  currentFeatureSetVersion,
  loadError,
}: {
  inventionId: string;
  featuresApproved: boolean;
  hasCompletedSearch: boolean;
  report: OverlapReportRecord | null;
  currentFeatureSetVersion: number;
  loadError?: string;
}) {
  const [state, action, pending] = useActionState(generateOverlapReport, initialState);
  const reportSummary = summary(report?.summary);
  const featureMatches = matches(report?.featureMatches);
  const complete = report?.status === "COMPLETED";
  const failed = report?.status === "FAILED";
  const processing = pending || report?.status === "PROCESSING";
  const enabled = featuresApproved && hasCompletedSearch;
  const stale = Boolean(report && (!featuresApproved || report.featureSetVersion !== currentFeatureSetVersion));

  return <section className="overlap-report-section">
    <div className="overlap-report-toolbar">
      <div><span className="overlap-report-icon" aria-hidden="true">≋</span><div><span className="eyebrow">MOCK OVERLAP PROVIDER</span><h2>Feature overlap assessment</h2><p>Deterministic keyword comparison against the latest completed patent search.</p></div></div>
      <form action={action}><input type="hidden" name="invention_id" value={inventionId} /><button type="submit" disabled={!enabled || processing}>{processing && <span className="auth-spinner" aria-hidden="true" />}{processing ? "Generating report…" : failed ? "Retry overlap report" : complete ? "Generate again" : "Generate overlap report"}</button></form>
    </div>

    <div className="overlap-disclaimer"><span>!</span><strong>Preliminary automated assessment — not legal advice.</strong></div>

    {!enabled && <div className="patent-search-notice"><span>◇</span><p><strong>Report prerequisites incomplete</strong>{!featuresApproved ? "Approve the extracted features first." : "Complete a patent search before generating a report."}</p></div>}
    {stale && report && <div className="downstream-version-note"><span>↺</span><p><strong>Older feature version</strong>This overlap report used feature set version {report.featureSetVersion}. It remains readable, but cannot be used for a new draft based on the current features.</p></div>}
    {loadError && <div className="patent-search-message patent-search-error" role="alert">{loadError}</div>}
    {state.error && <div className="patent-search-message patent-search-error" role="alert">{state.error}</div>}
    {state.message && <div className="patent-search-message patent-search-success" role="status">✓ {state.message}</div>}

    {processing && <div className="patent-search-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Comparing approved features</strong><p>Checking each feature against every patent title and available abstract…</p></div></div>}

    {!processing && complete && reportSummary && <div className={`overlap-summary summary-${reportSummary.classification.toLowerCase()}`}><div><span>REPORT SUMMARY</span><strong>{summaryLabels[reportSummary.classification]}</strong></div><dl><div><dt>Full</dt><dd>{reportSummary.fullMatches}</dd></div><div><dt>Partial</dt><dd>{reportSummary.partialMatches}</dd></div><div><dt>Not found</dt><dd>{reportSummary.notFound}</dd></div><div><dt>Uncertain</dt><dd>{reportSummary.uncertain}</dd></div></dl></div>}
    {!processing && complete && featureMatches.length > 0 && <ComparisonTable featureMatches={featureMatches} />}
    {!processing && complete && featureMatches.length === 0 && <div className="patent-search-empty"><span>≋</span><div><strong>No comparisons available</strong><p>The completed search did not contain enough patent data for a feature comparison.</p></div></div>}
    {!processing && failed && !state.error && <div className="patent-search-message patent-search-error" role="alert">{report.errorMessage ?? "The overlap report failed. Please retry."}</div>}
  </section>;
}
