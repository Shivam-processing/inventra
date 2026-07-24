import "server-only";

import { EpoOpsClient } from "@/lib/patents/epo-client";

type SearchInput = {
  title: string;
  technicalField: string;
  approvedFeatures: string[];
};

export type PatentSearchResult = {
  title: string;
  publicationNumber: string;
  priorityDate: string | null;
  publicationDate: string | null;
  applicant: string | null;
  abstract: string | null;
  sourceId: string;
  sourceUrl: string;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "in", "into", "is", "it", "of", "on", "or", "that", "the", "to",
  "using", "with", "system", "device", "method", "invention",
]);

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

function keywords(value: string, maximum = 5): string[] {
  const matches = value.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(matches)]
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, maximum);
}

function conciseTerm(value: string): string {
  return keywords(value).join(" ");
}

export function buildPatentSearchTerms(input: SearchInput): string[] {
  const candidates = [
    input.title,
    input.technicalField,
    ...input.approvedFeatures.slice(0, 3),
  ];

  return [...new Set(candidates.map(conciseTerm).filter(Boolean))].slice(0, 5);
}

function toCql(searchTerms: string[]): string {
  return searchTerms
    .map((term) => {
      const clauses = keywords(term).map((word) => `ta="${word}"`);
      return clauses.length > 1 ? `(${clauses.join(" and ")})` : clauses[0];
    })
    .filter(Boolean)
    .join(" or ");
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
  searchTerms: string[],
  client = new EpoOpsClient(),
): Promise<PatentSearchResult[]> {
  const query = toCql(searchTerms);
  if (!query) return [];

  const payload = record(await client.searchPublishedData(query, 10));
  const worldData = record(payload["ops:world-patent-data"]);
  const search = record(worldData["ops:biblio-search"]);
  const searchResult = record(search["ops:search-result"]);
  const exchangeDocuments = array(searchResult["exchange-documents"])
    .flatMap((group) => array(record(group)["exchange-document"]));

  return exchangeDocuments
    .map(normalizeDocument)
    .filter((result): result is PatentSearchResult => Boolean(result))
    .slice(0, 10);
}
