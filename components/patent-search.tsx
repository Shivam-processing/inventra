"use client";

import { useActionState } from "react";
import {
  searchSimilarPatents,
  type PatentSearchActionState,
} from "@/app/dashboard/inventions/[id]/patent-search-actions";
import type { PatentSearchResult } from "@/lib/patents/patent-search";

export type PatentSearchRecord = {
  status: string;
  searchTerms: string[];
  results: PatentSearchResult[];
  errorMessage: string | null;
};

const initialState: PatentSearchActionState = {};

function PatentResults({ results }: { results: PatentSearchResult[] }) {
  return <ol className="patent-result-list">
    {results.map((result, index) => <li key={`${result.publicationNumber}-${index}`}>
      <div className="patent-result-number"><span>{String(index + 1).padStart(2, "0")}</span><strong>{result.publicationNumber}</strong></div>
      <div className="patent-result-copy">
        <h3>{result.title}</h3>
        <dl>
          <div><dt>Applicant</dt><dd>{result.applicant ?? "Not listed"}</dd></div>
          <div><dt>{result.priorityDate ? "Priority date" : "Publication date"}</dt><dd>{result.priorityDate ?? result.publicationDate ?? "Not listed"}</dd></div>
        </dl>
        {result.abstract && <p>{result.abstract}</p>}
        <a href={result.sourceUrl} target="_blank" rel="noreferrer">View on Espacenet <span aria-hidden="true">↗</span><small>Source {result.sourceId}</small></a>
      </div>
    </li>)}
  </ol>;
}

export function PatentSearch({
  inventionId,
  featuresApproved,
  search,
  loadError,
}: {
  inventionId: string;
  featuresApproved: boolean;
  search: PatentSearchRecord | null;
  loadError?: string;
}) {
  const [state, action, pending] = useActionState(searchSimilarPatents, initialState);
  const complete = search?.status === "COMPLETED";
  const failed = search?.status === "FAILED";
  const processing = pending || search?.status === "PROCESSING";

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
    {loadError && <div className="patent-search-message patent-search-error" role="alert">{loadError}</div>}
    {state.error && <div className="patent-search-message patent-search-error" role="alert">{state.error}</div>}
    {state.message && <div className="patent-search-message patent-search-success" role="status">✓ {state.message}</div>}

    {processing && <div className="patent-search-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Searching EPO OPS</strong><p>Comparing concise technical queries with worldwide bibliographic data…</p></div></div>}

    {!processing && search?.searchTerms.length ? <div className="patent-search-terms"><span>SEARCH TERMS</span><div>{search.searchTerms.map((term) => <code key={term}>{term}</code>)}</div></div> : null}

    {!processing && complete && search.results.length > 0 && <PatentResults results={search.results} />}
    {!processing && complete && search.results.length === 0 && <div className="patent-search-empty"><span>⌕</span><div><strong>No matching patents found</strong><p>Try refining the approved features, then run the search again.</p></div></div>}
    {!processing && failed && !state.error && <div className="patent-search-message patent-search-error" role="alert">{search.errorMessage ?? "The EPO patent search failed. Please retry."}</div>}
  </section>;
}
