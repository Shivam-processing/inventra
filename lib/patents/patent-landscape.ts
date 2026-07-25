import type { FeatureOverlapMatch, OverlapMatchType } from "@/lib/patents/overlap-types";
import type { PatentSearchResult } from "@/lib/patents/patent-search";
import { buildPatentComparisonMatrix } from "@/lib/patents/feature-comparison";

export type LandscapeClassification = "high" | "partial" | "low" | "insufficient";
export type LandscapeCounts = Record<OverlapMatchType, number>;

export type LandscapeComparison = {
  feature: string;
  matchType: OverlapMatchType;
  matchedKeywords: string[];
  explanation: string;
};

export type LandscapePatent = {
  publicationNumber: string;
  title: string;
  applicant: string;
  date: string | null;
  abstract: string;
  sourceUrl: string | null;
  score: number;
  classification: LandscapeClassification;
  counts: LandscapeCounts;
  comparisons: LandscapeComparison[];
};

export type LandscapeFilters = {
  query: string;
  classification: "all" | LandscapeClassification;
  applicant: string;
  dateFrom: string;
  dateTo: string;
};

const weights: Record<OverlapMatchType, number> = { FULL: 100, PARTIAL: 60, UNCERTAIN: 30, NOT_FOUND: 0 };

export function observedOverlapScore(comparisons: Array<Pick<LandscapeComparison, "matchType">>): number | null {
  if (!comparisons.length || comparisons.every((comparison) => comparison.matchType === "UNCERTAIN")) return null;
  const average = comparisons.reduce((sum, comparison) => sum + weights[comparison.matchType], 0) / comparisons.length;
  return Math.max(0, Math.min(100, Math.round(average)));
}

export function classifyObservedOverlap(score: number | null): LandscapeClassification {
  if (score === null) return "insufficient";
  if (score >= 70) return "high";
  if (score >= 35) return "partial";
  return "low";
}

function emptyCounts(): LandscapeCounts {
  return { FULL: 0, PARTIAL: 0, NOT_FOUND: 0, UNCERTAIN: 0 };
}

function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildPatentLandscape(
  features: string[],
  patents: PatentSearchResult[],
  storedMatches: FeatureOverlapMatch[] = [],
): LandscapePatent[] {
  const matrix = buildPatentComparisonMatrix(features, patents.map((patent) => ({
    title: patent.title,
    publicationNumber: patent.publicationNumber,
    abstract: patent.abstract,
  })), storedMatches);

  return patents.map((patent, patentIndex) => {
    const comparisons = features.map((feature, featureIndex) => {
      const cell = matrix.cells[featureIndex]?.[patentIndex];
      return {
        feature,
        matchType: cell?.matchType ?? "UNCERTAIN",
        matchedKeywords: cell ? [...cell.matchedKeywords] : [],
        explanation: cell?.explanation ?? "Available text was insufficient for a deterministic comparison.",
      } satisfies LandscapeComparison;
    });
    const score = observedOverlapScore(comparisons);
    const counts = comparisons.reduce((result, comparison) => {
      result[comparison.matchType] += 1;
      return result;
    }, emptyCounts());
    return {
      publicationNumber: patent.publicationNumber,
      title: patent.title,
      applicant: patent.applicant?.trim() || "Not listed",
      date: patent.priorityDate ?? patent.publicationDate,
      abstract: patent.abstract?.trim() || "Not provided",
      sourceUrl: safeSourceUrl(patent.sourceUrl),
      score: score ?? 0,
      classification: classifyObservedOverlap(score),
      counts,
      comparisons,
    };
  });
}

function validDate(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function sortLandscapeTimeline(patents: LandscapePatent[]): LandscapePatent[] {
  return [...patents].sort((left, right) => {
    const leftDate = validDate(left.date);
    const rightDate = validDate(right.date);
    if (leftDate === null) return rightDate === null ? left.title.localeCompare(right.title) : 1;
    if (rightDate === null) return -1;
    return leftDate - rightDate;
  });
}

export function filterLandscapePatents(patents: LandscapePatent[], filters: LandscapeFilters): LandscapePatent[] {
  const query = filters.query.trim().toLocaleLowerCase("en");
  const from = validDate(filters.dateFrom);
  const to = validDate(filters.dateTo);
  return patents.filter((patent) => {
    const date = validDate(patent.date);
    return (!query || `${patent.title} ${patent.publicationNumber} ${patent.applicant}`.toLocaleLowerCase("en").includes(query))
      && (filters.classification === "all" || patent.classification === filters.classification)
      && (!filters.applicant || patent.applicant === filters.applicant)
      && (from === null || (date !== null && date >= from))
      && (to === null || (date !== null && date <= to));
  });
}

export function limitTopPatents(patents: LandscapePatent[], maximum: number): LandscapePatent[] {
  return [...patents].sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)).slice(0, Math.max(0, maximum));
}

export function timelineInsight(patents: LandscapePatent[]): string {
  const dated = patents.filter((patent) => validDate(patent.date) !== null);
  if (dated.length < 3) return "Too few dated results are available for a reliable trend.";
  const years = dated.map((patent) => Number(patent.date?.slice(0, 4))).filter(Number.isFinite);
  const latestYear = Math.max(...years);
  const recent = years.filter((year) => year >= latestYear - 2).length;
  if (recent / dated.length >= 0.6) return "Recent search results are concentrated in the last three years.";
  const highYears = new Set(dated.filter((patent) => patent.classification === "high").map((patent) => patent.date?.slice(0, 4)));
  if (highYears.size >= 2) return "High-overlap results are distributed across multiple years.";
  return "Dated search results are distributed across the available filing years.";
}

export function classificationLabel(classification: LandscapeClassification): string {
  return classification === "high" ? "High observed overlap"
    : classification === "partial" ? "Partial observed overlap"
      : classification === "low" ? "Low observed overlap" : "Insufficient information";
}
