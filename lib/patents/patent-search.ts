import "server-only";

import { EpoOpsClient } from "@/lib/patents/epo-client";
import {
  deduplicateRelevantPatents,
  filterAndDeduplicatePatents,
  patentSearchTerms,
  type PatentSearchPlan,
  type RelevanceSearchMode,
} from "@/lib/patents/patent-search-relevance";

export type PatentSearchResult = {
  title: string;
  publicationNumber: string;
  priorityDate: string | null;
  publicationDate: string | null;
  applicant: string | null;
  abstract: string | null;
  sourceId: string;
  sourceUrl: string;
  relevanceScore?: number;
  searchMode?: RelevanceSearchMode;
};

export type PatentSearchExecution = {
  results: PatentSearchResult[];
  mode: RelevanceSearchMode;
  searchTerms: string[];
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function array(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");

  const valueRecord = record(value);
  if (typeof valueRecord.$ === "string") return valueRecord.$;

  return Object.entries(valueRecord)
    .filter(([key]) => !key.startsWith("@"))
    .map(([, child]) => text(child))
    .filter(Boolean)
    .join(" ");
}

function localizedText(value: unknown): string {
  const entries = array(value).map(record);
  const english = entries.find((entry) => entry["@lang"] === "en");
  return text(english ?? entries[0]).trim();
}

function formatDate(value: unknown): string | null {
  const digits = text(value).replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function normalizeDocument(value: unknown): PatentSearchResult | null {
  const document = record(value);
  const bibliographic = record(document["bibliographic-data"]);
  const publicationReference = record(bibliographic["publication-reference"]);
  const documentIds = array(publicationReference["document-id"]).map(record);
  const docdb = documentIds.find((item) => item["@document-id-type"] === "docdb");

  const country = text(docdb?.country ?? document["@country"]);
  const documentNumber = text(docdb?.["doc-number"] ?? document["@doc-number"]);
  const kind = text(docdb?.kind ?? document["@kind"]);
  const publicationNumber = `${country}${documentNumber}${kind}`.replace(/\s/g, "");
  if (!publicationNumber) return null;

  const priorityClaims = record(bibliographic["priority-claims"]);
  const priorityDates = array(priorityClaims["priority-claim"])
    .flatMap((claim) => array(record(claim)["document-id"]))
    .map((identifier) => formatDate(record(identifier).date))
    .filter((date): date is string => Boolean(date))
    .sort();

  const parties = record(bibliographic.parties);
  const applicants = array(record(record(parties.applicants).applicant))
    .map(record);
  const applicant = applicants.find((item) => item["@data-format"] === "original")
    ?? applicants.find((item) => item["@data-format"] === "epodoc")
    ?? applicants[0];
  const applicantName = text(record(record(applicant?.["applicant-name"]).name)).trim();

  const rawAbstract = localizedText(document.abstract)
    .replace(/\[\d{4}\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sourceId = text(document["@family-id"]) || publicationNumber;

  return {
    title: localizedText(bibliographic["invention-title"]) || "Untitled patent",
    publicationNumber,
    priorityDate: priorityDates[0] ?? null,
    publicationDate: formatDate(docdb?.date),
    applicant: applicantName || null,
    abstract: rawAbstract || null,
    sourceId,
    sourceUrl: `https://worldwide.espacenet.com/patent/search?q=pn%3D${encodeURIComponent(publicationNumber)}`,
  };
}

export async function searchEpoPatents(
  plan: PatentSearchPlan,
  client = new EpoOpsClient(),
): Promise<PatentSearchExecution> {
  if (!plan.strictQuery) return { results: [], mode: "strict", searchTerms: patentSearchTerms(plan, "strict") };

  const strictResults = normalizeSearchPayload(await client.searchPublishedData(plan.strictQuery, 40));
  const usefulStrictResults = filterAndDeduplicatePatents(strictResults, plan, "strict");
  if (usefulStrictResults.length >= 5 || !plan.fallbackQuery || plan.fallbackQuery === plan.strictQuery) {
    return {
      results: usefulStrictResults.slice(0, 10),
      mode: "strict",
      searchTerms: patentSearchTerms(plan, "strict"),
    };
  }

  const fallbackResults = normalizeSearchPayload(await client.searchPublishedData(plan.fallbackQuery, 40));
  const usefulFallbackResults = filterAndDeduplicatePatents(fallbackResults, plan, "fallback");
  const results = deduplicateRelevantPatents([...usefulStrictResults, ...usefulFallbackResults]);

  return {
    results: results.slice(0, 10),
    mode: "fallback",
    searchTerms: patentSearchTerms(plan, "fallback"),
  };
}

function normalizeSearchPayload(payloadValue: unknown): PatentSearchResult[] {
  const payload = record(payloadValue);
  const worldData = record(payload["ops:world-patent-data"]);
  const search = record(worldData["ops:biblio-search"]);
  const searchResult = record(search["ops:search-result"]);
  const exchangeDocuments = array(searchResult["exchange-documents"])
    .flatMap((group) => array(record(group)["exchange-document"]));

  return exchangeDocuments
    .map(normalizeDocument)
    .filter((result): result is PatentSearchResult => Boolean(result));
}
