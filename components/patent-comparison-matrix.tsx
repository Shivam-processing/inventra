"use client";

import { useMemo, useState } from "react";
import {
  buildPatentComparisonMatrix,
  defaultPatentSelection,
  isPatentComparisonStale,
  reconcilePatentSelection,
  updatePatentSelection,
} from "@/lib/patents/feature-comparison";
import type { FeatureOverlapMatch, OverlapMatchType } from "@/lib/patents/overlap-types";
import { extractPatentJurisdiction } from "@/lib/patents/patent-result-filter";
import type { PatentSearchResult } from "@/lib/patents/patent-search";

type CompletedSearch = {
  id: string;
  status: string;
  featureSetVersion: number;
  results: PatentSearchResult[];
  completedAt: string | null;
};

type PatentOption = {
  id: string;
  patent: PatentSearchResult;
};

const MATCH_LABELS: Record<OverlapMatchType, string> = {
  FULL: "Full",
  PARTIAL: "Partial",
  NOT_FOUND: "Not found",
  UNCERTAIN: "Uncertain",
};

function parseExistingMatches(value: unknown): FeatureOverlapMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const matchType = source.matchType;
    if (
      typeof source.feature !== "string"
      || typeof source.explanation !== "string"
      || (matchType !== "FULL" && matchType !== "PARTIAL" && matchType !== "NOT_FOUND" && matchType !== "UNCERTAIN")
    ) return [];
    return [{
      feature: source.feature,
      matchedPatentTitle: typeof source.matchedPatentTitle === "string" ? source.matchedPatentTitle : null,
      publicationNumber: typeof source.publicationNumber === "string" ? source.publicationNumber : null,
      matchType,
      matchedKeywords: Array.isArray(source.matchedKeywords)
        ? source.matchedKeywords.filter((word): word is string => typeof word === "string")
        : [],
      matchedConcepts: Array.isArray(source.matchedConcepts) ? source.matchedConcepts.filter((word): word is string => typeof word === "string") : [],
      missingConcepts: Array.isArray(source.missingConcepts) ? source.missingConcepts.filter((word): word is string => typeof word === "string") : [],
      explanation: source.explanation,
    }];
  });
}

function MatchDetails({ match }: { match: ReturnType<typeof buildPatentComparisonMatrix>["cells"][number][number] }) {
  return <details className={`matrix-match matrix-match-${match.matchType.toLowerCase()}`}>
    <summary>
      <strong>{MATCH_LABELS[match.matchType]}</strong>
      <span>{match.matchedKeywords.length ? match.matchedKeywords.join(", ") : "No matched keywords"}</span>
      <i aria-hidden="true">+</i>
    </summary>
    <p>{match.explanation}</p>
  </details>;
}

function PatentSummary({ summary }: { summary: ReturnType<typeof buildPatentComparisonMatrix>["patentSummaries"][number] }) {
  return <dl className="matrix-patent-summary" aria-label="Patent match summary">
    <div><dt>Full</dt><dd>{summary.FULL}</dd></div>
    <div><dt>Partial</dt><dd>{summary.PARTIAL}</dd></div>
    <div><dt>Not found</dt><dd>{summary.NOT_FOUND}</dd></div>
    <div><dt>Uncertain</dt><dd>{summary.UNCERTAIN}</dd></div>
  </dl>;
}

function MatrixTable({
  features,
  patents,
  matrix,
}: {
  features: string[];
  patents: PatentSearchResult[];
  matrix: ReturnType<typeof buildPatentComparisonMatrix>;
}) {
  return <div className="patent-matrix-scroll" tabIndex={0} aria-label="Scrollable patent feature-comparison matrix">
    <table className="patent-matrix-table">
      <thead><tr>
        <th className="matrix-feature-column" scope="col">Approved feature</th>
        {patents.map((patent, index) => {
          const jurisdiction = extractPatentJurisdiction(patent.publicationNumber) ?? "Unknown";
          return <th scope="col" key={`${patent.publicationNumber}-${index}`}>
            <a href={patent.sourceUrl} target="_blank" rel="noreferrer">{patent.title}<span aria-hidden="true">↗</span></a>
            <small>{patent.publicationNumber} · {jurisdiction}</small>
            <PatentSummary summary={matrix.patentSummaries[index]} />
          </th>;
        })}
      </tr></thead>
      <tbody>{features.map((feature, featureIndex) => {
        const summary = matrix.featureSummaries[featureIndex];
        return <tr key={`${feature}-${featureIndex}`}>
          <th className="matrix-feature-column" scope="row">
            <strong>{feature}</strong>
            <span>Strongest: {MATCH_LABELS[summary.strongestMatch]}</span>
            <small>{summary.matchingPatentCount} of {patents.length} with full or partial matches</small>
          </th>
          {matrix.cells[featureIndex].map((match, patentIndex) => <td key={`${match.publicationNumber}-${patentIndex}`}><MatchDetails match={match} /></td>)}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function MatrixCards({
  features,
  patents,
  matrix,
}: {
  features: string[];
  patents: PatentSearchResult[];
  matrix: ReturnType<typeof buildPatentComparisonMatrix>;
}) {
  return <div className="patent-matrix-cards">
    {features.map((feature, featureIndex) => {
      const summary = matrix.featureSummaries[featureIndex];
      return <article key={`${feature}-${featureIndex}`}>
        <header><span>FEATURE {String(featureIndex + 1).padStart(2, "0")}</span><h3>{feature}</h3><p>Strongest: <strong>{MATCH_LABELS[summary.strongestMatch]}</strong> · {summary.matchingPatentCount} of {patents.length} full or partial</p></header>
        <div>{patents.map((patent, patentIndex) => <section key={`${patent.publicationNumber}-${patentIndex}`}>
          <a href={patent.sourceUrl} target="_blank" rel="noreferrer">{patent.title}<span aria-hidden="true">↗</span></a>
          <small>{patent.publicationNumber} · {extractPatentJurisdiction(patent.publicationNumber) ?? "Unknown"}</small>
          <MatchDetails match={matrix.cells[featureIndex][patentIndex]} />
        </section>)}</div>
      </article>;
    })}
  </div>;
}

type PatentComparisonMatrixProps = {
  features: string[];
  featuresApproved: boolean;
  currentFeatureSetVersion: number;
  search: CompletedSearch | null;
  loading: boolean;
  existingOverlapMatches?: unknown;
};

function formatCompletionDate(value: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function PatentComparisonMatrixContent({
  features,
  featuresApproved,
  currentFeatureSetVersion,
  search,
  loading,
  existingOverlapMatches,
}: PatentComparisonMatrixProps) {
  const patentOptions = useMemo<PatentOption[]>(() => search?.results.map((patent, index) => ({
    id: `${patent.sourceId}:${patent.publicationNumber}:${index}`,
    patent,
  })) ?? [], [search]);
  const [selectedIds, setSelectedIds] = useState(() => defaultPatentSelection(
    patentOptions.map((option) => ({ id: option.id, relevanceScore: option.patent.relevanceScore })),
  ));
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const reconciledSelection = useMemo(() => reconcilePatentSelection(
    selectedIds,
    patentOptions.map((option) => ({ id: option.id, relevanceScore: option.patent.relevanceScore })),
    false,
  ), [patentOptions, selectedIds]);
  const currentSelectedIds = reconciledSelection.selection;
  const selectedOptions = useMemo(
    () => patentOptions.filter((option) => currentSelectedIds.includes(option.id)),
    [currentSelectedIds, patentOptions],
  );
  const approvedFeatures = useMemo(() => featuresApproved ? features : [], [features, featuresApproved]);
  const stale = Boolean(search && isPatentComparisonStale(search.featureSetVersion, currentFeatureSetVersion));
  const parsedMatches = useMemo(() => parseExistingMatches(existingOverlapMatches), [existingOverlapMatches]);
  const currentPublicationNumbers = useMemo(() => new Set(patentOptions.map((option) => option.patent.publicationNumber.trim().toLocaleUpperCase("en"))), [patentOptions]);
  const excludedForeignMatch = parsedMatches.some((match) => match.publicationNumber && !currentPublicationNumbers.has(match.publicationNumber.trim().toLocaleUpperCase("en")));
  const excludedStaleData = reconciledSelection.removedMissing || excludedForeignMatch;
  const comparison = useMemo(() => {
    try {
      return {
        matrix: buildPatentComparisonMatrix(
          approvedFeatures,
          selectedOptions.map((option) => option.patent),
          parsedMatches,
        ),
        error: null,
      };
    } catch {
      return { matrix: null, error: "The patent comparison matrix could not be calculated. Please retry." };
    }
  }, [approvedFeatures, parsedMatches, selectedOptions]);

  function togglePatent(option: PatentOption, selected: boolean) {
    const update = updatePatentSelection(currentSelectedIds, option.id, selected);
    setSelectedIds(update.selection);
    setSelectionError(update.limitReached ? "Select no more than five patents." : null);
  }

  return <section className="patent-comparison-matrix" aria-labelledby="patent-matrix-title">
    <header className="patent-matrix-heading">
      <div><span className="patent-matrix-icon" aria-hidden="true">⊞</span><div><span className="eyebrow">DETERMINISTIC COMPARISON</span><h2 id="patent-matrix-title">Patent comparison matrix</h2><p>Compare each approved feature with up to five selected patent records.</p></div></div>
      <span className={stale ? "matrix-version stale" : "matrix-version"}>Feature set v{currentFeatureSetVersion}</span>
    </header>

    <aside className="matrix-review-note" role="note"><span aria-hidden="true">!</span><p>Feature matches are deterministic preliminary comparisons and require professional review.</p></aside>
    {search && <div className="patent-results-count" aria-label="Comparison matrix source search">
      <strong>Current search</strong>
      <span>Feature set v{search.featureSetVersion} · Completed {formatCompletionDate(search.completedAt)} · {patentOptions.length} patent{patentOptions.length === 1 ? "" : "s"} available</span>
    </div>}
    {excludedStaleData && <div className="patent-search-message patent-search-error" role="alert">A saved patent selection or comparison entry was not present in the current search and was excluded.</div>}
    {stale && search && <div className="downstream-version-note"><span>↺</span><p><strong>Outdated patent search</strong>This search used feature set v{search.featureSetVersion}, while the current approved feature set is v{currentFeatureSetVersion}. The comparison remains readable but is not current.</p></div>}

    {loading && <div className="patent-search-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Waiting for patent results</strong><p>The comparison matrix will be available when the current search completes.</p></div></div>}
    {!loading && approvedFeatures.length === 0 && <div className="patent-search-empty"><span>◇</span><div><strong>No approved features available</strong><p>Approve the feature list before comparing it with patent results.</p></div></div>}
    {!loading && approvedFeatures.length > 0 && (!search || search.status !== "COMPLETED") && <div className="patent-search-empty"><span>⌕</span><div><strong>No completed patent search</strong><p>Complete a patent search to build the comparison matrix.</p></div></div>}
    {!loading && approvedFeatures.length > 0 && search?.status === "COMPLETED" && patentOptions.length === 0 && <div className="patent-search-empty"><span>⊞</span><div><strong>No patent results available</strong><p>The completed search does not contain patent results to compare.</p></div></div>}

    {!loading && approvedFeatures.length > 0 && search?.status === "COMPLETED" && patentOptions.length > 0 && <>
      <div className="matrix-selection-toolbar">
        <div><strong>Select patents</strong><span role="status">{currentSelectedIds.length} of 5 selected</span></div>
        <div><button type="button" onClick={() => { setSelectedIds(defaultPatentSelection(patentOptions.map((option) => ({ id: option.id, relevanceScore: option.patent.relevanceScore })))); setSelectionError(null); }}>Select first 3</button><button type="button" disabled={currentSelectedIds.length === 0} onClick={() => { setSelectedIds([]); setSelectionError(null); }}>Clear selection</button></div>
      </div>
      <div className="matrix-patent-selector" role="group" aria-label="Patents included in the comparison matrix">
        {patentOptions.map((option) => {
          const selected = currentSelectedIds.includes(option.id);
          const disabled = !selected && currentSelectedIds.length >= 5;
          return <label className={selected ? "selected" : ""} aria-disabled={disabled} key={option.id}>
            <input type="checkbox" checked={selected} disabled={disabled} onChange={(event) => togglePatent(option, event.target.checked)} />
            <span aria-hidden="true">✓</span>
            <strong>{option.patent.title}</strong>
            <small>{option.patent.publicationNumber} · {extractPatentJurisdiction(option.patent.publicationNumber) ?? "Unknown"}</small>
          </label>;
        })}
      </div>
      {selectionError && <div className="patent-filter-error" role="alert">{selectionError}</div>}
      {selectedOptions.length === 0 && <div className="patent-search-empty"><span>⊞</span><div><strong>No patents selected</strong><p>Select at least one patent to display the feature-comparison matrix.</p></div></div>}
      {selectedOptions.length > 0 && comparison.error && <div className="patent-search-message patent-search-error" role="alert">{comparison.error}</div>}
      {selectedOptions.length > 0 && comparison.matrix && <>
        <MatrixTable features={approvedFeatures} patents={selectedOptions.map((option) => option.patent)} matrix={comparison.matrix} />
        <MatrixCards features={approvedFeatures} patents={selectedOptions.map((option) => option.patent)} matrix={comparison.matrix} />
      </>}
    </>}
  </section>;
}

export function PatentComparisonMatrix(props: PatentComparisonMatrixProps) {
  return <PatentComparisonMatrixContent key={props.search?.id ?? "no-current-search"} {...props} />;
}
