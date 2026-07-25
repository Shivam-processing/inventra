"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  searchSimilarPatents,
  type PatentSearchActionState,
} from "@/app/dashboard/inventions/[id]/patent-search-actions";
import { PatentComparisonMatrix } from "@/components/patent-comparison-matrix";
import {
  EMPTY_PATENT_RESULT_FILTERS,
  extractPatentJurisdiction,
  filterPatentResults,
  paginatePatentResults,
  patentResultDate,
  type PatentResultFilters,
  type PatentResultSort,
} from "@/lib/patents/patent-result-filter";
import type { PatentSearchResult } from "@/lib/patents/patent-search";

export type PatentSearchRecord = {
  id: string;
  status: string;
  featureSetVersion: number;
  searchTerms: string[];
  results: PatentSearchResult[];
  errorMessage: string | null;
  completedAt: string | null;
};

const initialState: PatentSearchActionState = {};
const PARAMS = {
  search: "patent_search",
  keyword: "patent_q",
  publication: "patent_number",
  jurisdiction: "patent_country",
  dateFrom: "patent_from",
  dateTo: "patent_to",
  version: "patent_version",
  currency: "patent_scope",
  sort: "patent_sort",
  page: "patent_page",
} as const;
const PATENT_PARAM_NAMES = Object.values(PARAMS);
const SORTS = new Set<PatentResultSort>(["", "closest", "newest", "oldest", "title", "publication"]);

function PatentResult({ result, index }: { result: PatentSearchResult; index: number }) {
  const [abstractExpanded, setAbstractExpanded] = useState(false);
  const abstractId = useId();
  const abstractIsLong = Boolean(result.abstract && result.abstract.length > 420);
  const jurisdiction = extractPatentJurisdiction(result.publicationNumber) ?? "Unknown";

  return <li>
    <div className="patent-result-number"><span>{String(index + 1).padStart(2, "0")}</span><strong>{result.publicationNumber}</strong></div>
    <div className="patent-result-copy">
      <h3>{result.title}</h3>
      <dl>
        <div><dt>Applicant</dt><dd>{result.applicant ?? "Not listed"}</dd></div>
        <div><dt>Jurisdiction</dt><dd>{jurisdiction}</dd></div>
        <div><dt>{result.priorityDate ? "Priority date" : "Publication date"}</dt><dd>{result.priorityDate ?? result.publicationDate ?? "Not listed"}</dd></div>
        {typeof result.relevanceScore === "number" && <div><dt>Search relevance</dt><dd>{result.relevanceScore} points{result.searchMode ? ` · ${result.searchMode}` : ""}</dd></div>}
      </dl>
      {result.abstract && <>
        <p id={abstractId} className={!abstractIsLong || abstractExpanded ? "patent-abstract expanded" : "patent-abstract"}>{result.abstract}</p>
        {abstractIsLong && <button className="patent-abstract-toggle" type="button" aria-expanded={abstractExpanded} aria-controls={abstractId} onClick={() => setAbstractExpanded((expanded) => !expanded)}>
          {abstractExpanded ? "Show less" : "Read full abstract"}
        </button>}
      </>}
      <a href={result.sourceUrl} target="_blank" rel="noreferrer">View on Espacenet <span aria-hidden="true">↗</span><small>Source {result.sourceId}</small></a>
    </div>
  </li>;
}

function PatentResults({ results, offset }: { results: PatentSearchResult[]; offset: number }) {
  return <ol className="patent-result-list">
    {results.map((result, index) => <PatentResult result={result} index={offset + index} key={`${result.publicationNumber}-${offset + index}`} />)}
  </ol>;
}

function readFilters(searchParams: URLSearchParams | Readonly<URLSearchParams>, searchId: string) {
  if (searchParams.get(PARAMS.search) !== searchId) {
    return { filters: EMPTY_PATENT_RESULT_FILTERS, page: 1 };
  }

  const rawSort = searchParams.get(PARAMS.sort) ?? "";
  const rawCurrency = searchParams.get(PARAMS.currency) ?? "";
  const rawVersion = Number(searchParams.get(PARAMS.version));
  const rawPage = Number(searchParams.get(PARAMS.page));
  return {
    filters: {
      keyword: searchParams.get(PARAMS.keyword) ?? "",
      publicationNumber: searchParams.get(PARAMS.publication) ?? "",
      jurisdiction: searchParams.get(PARAMS.jurisdiction) ?? "",
      dateFrom: searchParams.get(PARAMS.dateFrom) ?? "",
      dateTo: searchParams.get(PARAMS.dateTo) ?? "",
      featureSetVersion: Number.isInteger(rawVersion) && rawVersion > 0 ? rawVersion : null,
      currency: rawCurrency === "current" || rawCurrency === "outdated" ? rawCurrency : "",
      sort: SORTS.has(rawSort as PatentResultSort) ? rawSort as PatentResultSort : "",
    } satisfies PatentResultFilters,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function activeFilterLabels(filters: PatentResultFilters) {
  const labels: string[] = [];
  if (filters.keyword.trim()) labels.push(`Keyword: ${filters.keyword.trim()}`);
  if (filters.publicationNumber.trim()) labels.push(`Publication: ${filters.publicationNumber.trim()}`);
  if (filters.jurisdiction) labels.push(`Jurisdiction: ${filters.jurisdiction === "UNKNOWN" ? "Unknown" : filters.jurisdiction}`);
  if (filters.dateFrom) labels.push(`From: ${filters.dateFrom}`);
  if (filters.dateTo) labels.push(`To: ${filters.dateTo}`);
  if (filters.featureSetVersion !== null) labels.push(`Feature set: v${filters.featureSetVersion}`);
  if (filters.currency) labels.push(filters.currency === "current" ? "Current search" : "Outdated search");
  if (filters.sort) {
    const sortLabels: Record<Exclude<PatentResultSort, "">, string> = {
      closest: "Closest match",
      newest: "Newest date",
      oldest: "Oldest date",
      title: "Title A–Z",
      publication: "Publication number",
    };
    labels.push(`Sort: ${sortLabels[filters.sort]}`);
  }
  return labels;
}

function PatentResultBrowser({ search, isCurrentSearch }: { search: PatentSearchRecord; isCurrentSearch: boolean }) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [formError, setFormError] = useState<string | null>(null);
  const { filters, page: requestedPage } = useMemo(
    () => readFilters(new URLSearchParams(queryString), search.id),
    [queryString, search.id],
  );
  const filtered = useMemo(
    () => filterPatentResults(search.results, filters, { searchFeatureSetVersion: search.featureSetVersion, isCurrentSearch }),
    [filters, isCurrentSearch, search.featureSetVersion, search.results],
  );
  const pagination = paginatePatentResults(filtered.results, requestedPage);
  const jurisdictions = useMemo(() => [...new Set(search.results.map((result) => extractPatentJurisdiction(result.publicationNumber)).filter((value): value is string => Boolean(value)))].sort(), [search.results]);
  const hasUnknownJurisdiction = search.results.some((result) => !extractPatentJurisdiction(result.publicationNumber));
  const hasDates = search.results.some((result) => patentResultDate(result) !== null);
  const activeLabels = activeFilterLabels(filters);
  const filterCount = activeLabels.filter((label) => !label.startsWith("Sort:")).length;

  function updateUrl(nextFilters: PatentResultFilters, nextPage = 1) {
    const params = new URLSearchParams(searchParams.toString());
    PATENT_PARAM_NAMES.forEach((name) => params.delete(name));
    const hasState = activeFilterLabels(nextFilters).length > 0 || nextPage > 1;
    if (hasState) {
      params.set(PARAMS.search, search.id);
      if (nextFilters.keyword.trim()) params.set(PARAMS.keyword, nextFilters.keyword.trim());
      if (nextFilters.publicationNumber.trim()) params.set(PARAMS.publication, nextFilters.publicationNumber.trim());
      if (nextFilters.jurisdiction) params.set(PARAMS.jurisdiction, nextFilters.jurisdiction);
      if (nextFilters.dateFrom) params.set(PARAMS.dateFrom, nextFilters.dateFrom);
      if (nextFilters.dateTo) params.set(PARAMS.dateTo, nextFilters.dateTo);
      if (nextFilters.featureSetVersion !== null) params.set(PARAMS.version, String(nextFilters.featureSetVersion));
      if (nextFilters.currency) params.set(PARAMS.currency, nextFilters.currency);
      if (nextFilters.sort) params.set(PARAMS.sort, nextFilters.sort);
      if (nextPage > 1) params.set(PARAMS.page, String(nextPage));
    }
    const query = params.toString();
    window.history.pushState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const version = Number(data.get("feature_version"));
    const currency = String(data.get("currency") ?? "");
    const nextFilters: PatentResultFilters = {
      keyword: String(data.get("keyword") ?? ""),
      publicationNumber: String(data.get("publication_number") ?? ""),
      jurisdiction: String(data.get("jurisdiction") ?? ""),
      dateFrom: String(data.get("date_from") ?? ""),
      dateTo: String(data.get("date_to") ?? ""),
      featureSetVersion: Number.isInteger(version) && version > 0 ? version : null,
      currency: currency === "current" || currency === "outdated" ? currency : "",
      sort: SORTS.has(String(data.get("sort")) as PatentResultSort) ? String(data.get("sort")) as PatentResultSort : "",
    };
    const validation = filterPatentResults(search.results, nextFilters, { searchFeatureSetVersion: search.featureSetVersion, isCurrentSearch });
    if (validation.validationError) {
      setFormError(validation.validationError);
      return;
    }
    setFormError(null);
    updateUrl(nextFilters, 1);
  }

  function clearFilters() {
    setFormError(null);
    updateUrl(EMPTY_PATENT_RESULT_FILTERS, 1);
  }

  return <div className="patent-results-browser">
    <details className="patent-filter-panel">
      <summary>
        <span>Filter and sort results</span>
        {filterCount > 0 && <small>{filterCount} active</small>}
        <i aria-hidden="true">⌄</i>
      </summary>
      <form className="patent-filter-form" onSubmit={applyFilters} key={`${search.id}-${queryString}`}>
        <label className="patent-filter-wide"><span>Keyword</span><input name="keyword" type="search" defaultValue={filters.keyword} placeholder="Title, abstract, or publication number" /></label>
        <label><span>Publication number</span><input name="publication_number" type="search" defaultValue={filters.publicationNumber} placeholder="e.g. EP1234567" /></label>
        {jurisdictions.length > 0 && <label><span>Jurisdiction</span><select name="jurisdiction" defaultValue={filters.jurisdiction}><option value="">All jurisdictions</option>{jurisdictions.map((jurisdiction) => <option value={jurisdiction} key={jurisdiction}>{jurisdiction}</option>)}{hasUnknownJurisdiction && <option value="UNKNOWN">Unknown</option>}</select></label>}
        {hasDates && <><label><span>From date</span><input name="date_from" type="date" defaultValue={filters.dateFrom} /></label><label><span>To date</span><input name="date_to" type="date" defaultValue={filters.dateTo} /></label></>}
        <label><span>Feature-set version</span><select name="feature_version" defaultValue={filters.featureSetVersion ?? ""}><option value="">All versions</option><option value={search.featureSetVersion}>Version {search.featureSetVersion}</option></select></label>
        <label><span>Search state</span><select name="currency" defaultValue={filters.currency}><option value="">Current and outdated</option><option value="current">Current only</option><option value="outdated">Outdated only</option></select></label>
        <label><span>Sort results</span><select name="sort" defaultValue={filters.sort}><option value="">Original result order</option><option value="closest">Closest match first</option><option value="newest">Newest date first</option><option value="oldest">Oldest date first</option><option value="title">Patent title A–Z</option><option value="publication">Publication number</option></select></label>
        <div className="patent-filter-actions"><button type="button" onClick={clearFilters} disabled={activeLabels.length === 0 && !formError}>Clear all filters</button><button type="submit">Apply filters</button></div>
      </form>
    </details>

    {(formError || filtered.validationError) && <div className="patent-filter-error" role="alert">{formError ?? filtered.validationError}</div>}
    {activeLabels.length > 0 && <div className="patent-active-filters" aria-label="Active patent result filters"><strong>Active</strong>{activeLabels.map((label) => <span key={label}>{label}</span>)}</div>}
    <div className="patent-results-count" role="status"><strong>Showing {filtered.results.length} of {search.results.length} patent results</strong><span>Feature set v{search.featureSetVersion} · {isCurrentSearch ? "Current search" : "Outdated search"}</span></div>

    {pagination.items.length > 0
      ? <PatentResults results={pagination.items} offset={(pagination.page - 1) * pagination.pageSize} />
      : <div className="patent-filter-empty"><span>⌕</span><div><strong>No results match these filters</strong><p>Clear or adjust the filters to see patent results from this search.</p></div><button type="button" onClick={clearFilters}>Clear all filters</button></div>}

    {pagination.totalPages > 1 && <nav className="patent-result-pagination" aria-label="Patent result pages">
      <button type="button" disabled={pagination.page === 1} onClick={() => updateUrl(filters, pagination.page - 1)} aria-label="Go to previous patent result page">← Previous</button>
      <span>Page {pagination.page} of {pagination.totalPages}</span>
      <button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => updateUrl(filters, pagination.page + 1)} aria-label="Go to next patent result page">Next →</button>
    </nav>}
  </div>;
}

export function PatentSearch({
  inventionId,
  featuresApproved,
  search,
  matrixSearch,
  currentFeatureSetVersion,
  approvedFeatures,
  existingOverlapMatches,
  loadError,
}: {
  inventionId: string;
  featuresApproved: boolean;
  search: PatentSearchRecord | null;
  matrixSearch: PatentSearchRecord | null;
  currentFeatureSetVersion: number;
  approvedFeatures: string[];
  existingOverlapMatches?: unknown;
  loadError?: string;
}) {
  const [state, action, pending] = useActionState(searchSimilarPatents, initialState);
  const complete = search?.status === "COMPLETED";
  const failed = search?.status === "FAILED";
  const processing = pending || search?.status === "PROCESSING";
  const stale = Boolean(search && (!featuresApproved || search.featureSetVersion !== currentFeatureSetVersion));

  return <section className="patent-search-section">
    <div className="patent-search-toolbar">
      <div><span className="patent-search-icon" aria-hidden="true">⌕</span><div><h2>Search EPO patent data</h2><p>Find related publications using the invention title, technical field, and approved features.</p></div></div>
      <form action={action}>
        <input type="hidden" name="invention_id" value={inventionId} />
        <button type="submit" disabled={!featuresApproved || processing}>
          {processing && <span className="auth-spinner" aria-hidden="true" />}
          {processing ? "Searching patents…" : failed ? "Retry patent search" : complete ? "Search again" : "Search similar patents"}
        </button>
      </form>
    </div>

    {!featuresApproved && <div className="patent-search-notice"><span>◇</span><p><strong>Feature approval required</strong>Review and approve the extracted features before searching EPO patent data.</p></div>}
    {stale && search && <div className="downstream-version-note"><span>↺</span><p><strong>Older feature version</strong>This search used feature set version {search.featureSetVersion}. It remains readable, but new downstream generation requires the current approved feature set.</p></div>}
    {loadError && <div className="patent-search-message patent-search-error" role="alert">{loadError}</div>}
    {state.error && <div className="patent-search-message patent-search-error" role="alert">{state.error}</div>}
    {state.message && <div className="patent-search-message patent-search-success" role="status">✓ {state.message}</div>}
    {!processing && complete && !stale && search.results.length > 0 && <Link className="button button-default" href={`/dashboard/inventions/${inventionId}/landscape`}>Explore patent landscape</Link>}

    {processing && <div className="patent-search-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Searching EPO OPS</strong><p>Comparing concise technical queries with worldwide bibliographic data…</p></div></div>}

    {!processing && search?.searchTerms.length ? <div className="patent-search-terms"><span>SEARCH TERMS</span><div>{search.searchTerms.map((term) => <code key={term}>{term}</code>)}</div></div> : null}

    {!processing && complete && search.results.length > 0 && <PatentResultBrowser search={search} isCurrentSearch={!stale} />}
    {!processing && complete && search.results.length === 0 && <div className="patent-search-empty"><span>⌕</span><div><strong>No sufficiently relevant prior-art results were found using the current search terms.</strong><p>Refine the approved features and try again.</p></div></div>}
    {!processing && failed && !state.error && <div className="patent-search-message patent-search-error" role="alert">{search.errorMessage ?? "The EPO patent search failed. Please retry."}</div>}
    <PatentComparisonMatrix
      key={matrixSearch?.id ?? "no-current-patent-search"}
      features={approvedFeatures}
      featuresApproved={featuresApproved}
      currentFeatureSetVersion={currentFeatureSetVersion}
      search={matrixSearch}
      loading={processing && !matrixSearch}
      existingOverlapMatches={existingOverlapMatches}
    />
  </section>;
}
