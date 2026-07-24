export type FilterablePatentResult = {
  title: string;
  publicationNumber: string;
  priorityDate: string | null;
  publicationDate: string | null;
  abstract: string | null;
};

export type PatentResultSort = "" | "closest" | "newest" | "oldest" | "title" | "publication";

export type PatentResultFilters = {
  keyword: string;
  publicationNumber: string;
  jurisdiction: string;
  dateFrom: string;
  dateTo: string;
  featureSetVersion: number | null;
  currency: "" | "current" | "outdated";
  sort: PatentResultSort;
};

type FilterContext = {
  searchFeatureSetVersion: number;
  isCurrentSearch: boolean;
};

export type FilterPatentResultsResult<T> = {
  results: T[];
  validationError: string | null;
};

export const EMPTY_PATENT_RESULT_FILTERS: PatentResultFilters = {
  keyword: "",
  publicationNumber: "",
  jurisdiction: "",
  dateFrom: "",
  dateTo: "",
  featureSetVersion: null,
  currency: "",
  sort: "",
};

function normalized(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("en") ?? "";
}

export function extractPatentJurisdiction(publicationNumber: string): string | null {
  const compact = publicationNumber.trim().toUpperCase().replace(/[\s.-]/g, "");
  const match = compact.match(/^([A-Z]{2})(?=\d)/);
  return match?.[1] ?? null;
}

export function parsePatentDate(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? timestamp
    : null;
}

export function patentResultDate(result: FilterablePatentResult): number | null {
  return parsePatentDate(result.priorityDate) ?? parsePatentDate(result.publicationDate);
}

export function filterPatentResults<T extends FilterablePatentResult>(
  results: T[],
  filters: PatentResultFilters,
  context: FilterContext,
): FilterPatentResultsResult<T> {
  const keyword = normalized(filters.keyword);
  const publicationNumber = normalized(filters.publicationNumber);
  const jurisdiction = filters.jurisdiction.trim().toUpperCase();
  const from = filters.dateFrom ? parsePatentDate(filters.dateFrom) : null;
  const to = filters.dateTo ? parsePatentDate(filters.dateTo) : null;
  let validationError: string | null = null;

  if (filters.dateFrom && from === null) validationError = "Enter a valid start date.";
  else if (filters.dateTo && to === null) validationError = "Enter a valid end date.";
  else if (from !== null && to !== null && from > to) validationError = "The start date must be on or before the end date.";

  const validDateRange = validationError === null;
  const indexed = results.map((result, originalIndex) => ({ result, originalIndex }));
  const filtered = indexed.filter(({ result }) => {
    const searchable = normalized(`${result.title} ${result.abstract ?? ""} ${result.publicationNumber}`);
    if (keyword && !searchable.includes(keyword)) return false;
    if (publicationNumber && !normalized(result.publicationNumber).includes(publicationNumber)) return false;
    if (jurisdiction && (extractPatentJurisdiction(result.publicationNumber) ?? "UNKNOWN") !== jurisdiction) return false;
    if (filters.featureSetVersion !== null && context.searchFeatureSetVersion !== filters.featureSetVersion) return false;
    if (filters.currency === "current" && !context.isCurrentSearch) return false;
    if (filters.currency === "outdated" && context.isCurrentSearch) return false;

    if (validDateRange && (from !== null || to !== null)) {
      const resultDate = patentResultDate(result);
      if (resultDate === null) return false;
      if (from !== null && resultDate < from) return false;
      if (to !== null && resultDate > to) return false;
    }

    return true;
  });

  if (filters.sort === "newest" || filters.sort === "oldest") {
    const direction = filters.sort === "newest" ? -1 : 1;
    filtered.sort((a, b) => {
      const aDate = patentResultDate(a.result);
      const bDate = patentResultDate(b.result);
      if (aDate === null && bDate === null) return a.originalIndex - b.originalIndex;
      if (aDate === null) return 1;
      if (bDate === null) return -1;
      return (aDate - bDate) * direction || a.originalIndex - b.originalIndex;
    });
  } else if (filters.sort === "title") {
    filtered.sort((a, b) => a.result.title.localeCompare(b.result.title, "en", { sensitivity: "base" }) || a.originalIndex - b.originalIndex);
  } else if (filters.sort === "publication") {
    filtered.sort((a, b) => a.result.publicationNumber.localeCompare(b.result.publicationNumber, "en", { numeric: true, sensitivity: "base" }) || a.originalIndex - b.originalIndex);
  }

  return { results: filtered.map(({ result }) => result), validationError };
}

export function paginatePatentResults<T>(results: T[], requestedPage: number, pageSize = 10) {
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const start = (page - 1) * pageSize;
  return {
    items: results.slice(start, start + pageSize),
    page,
    pageSize,
    totalPages,
  };
}
