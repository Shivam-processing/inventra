import type { FeatureOverlapMatch, OverlapMatchType } from "@/lib/patents/overlap-types";
import { compareConceptGroups } from "@/lib/patents/concept-matching";

export type ComparisonPatent = {
  title: string;
  publicationNumber: string;
  abstract: string | null;
};

export type ComparisonCell = {
  feature: string;
  publicationNumber: string;
  matchType: OverlapMatchType;
  matchedKeywords: string[];
  matchedConcepts: string[];
  missingConcepts: string[];
  explanation: string;
};

export type PatentMatchSummary = Record<OverlapMatchType, number>;

export type FeatureMatchSummary = {
  feature: string;
  strongestMatch: OverlapMatchType;
  matchingPatentCount: number;
};

export type PatentComparisonMatrix = {
  cells: ComparisonCell[][];
  patentSummaries: PatentMatchSummary[];
  featureSummaries: FeatureMatchSummary[];
};

export type CompletedPatentSearchCandidate = {
  id: string;
  status: string;
  featureSetVersion: number;
  completedAt: string | null;
  createdAt: string | null;
};

export type SelectablePatent = {
  id: string;
  relevanceScore?: number;
};

const MATCH_STRENGTH: Record<OverlapMatchType, number> = {
  FULL: 4,
  PARTIAL: 3,
  UNCERTAIN: 2,
  NOT_FOUND: 1,
};

export function compareFeatureToPatent(feature: string, patent: ComparisonPatent): ComparisonCell {
  const result = compareConceptGroups(feature, patent.title, patent.abstract);

  return {
    feature,
    publicationNumber: patent.publicationNumber,
    matchType: result.matchType,
    matchedKeywords: result.matchedEvidence,
    matchedConcepts: result.matchedConcepts,
    missingConcepts: result.missingConcepts,
    explanation: result.explanation,
  };
}

function storedMatchKey(feature: string, publicationNumber: string) {
  return `${feature.trim().toLocaleLowerCase("en")}\u0000${publicationNumber.trim().toLocaleUpperCase("en")}`;
}

function emptyPatentSummary(): PatentMatchSummary {
  return { FULL: 0, PARTIAL: 0, NOT_FOUND: 0, UNCERTAIN: 0 };
}

export function buildPatentComparisonMatrix(
  features: string[],
  patents: ComparisonPatent[],
  existingMatches: FeatureOverlapMatch[] = [],
): PatentComparisonMatrix {
  const stored = new Map(existingMatches.flatMap((match) => match.publicationNumber
    ? [[storedMatchKey(match.feature, match.publicationNumber), match] as const]
    : []));

  const cells = features.map((feature) => patents.map((patent) => {
    const existing = stored.get(storedMatchKey(feature, patent.publicationNumber));
    if (!existing) return compareFeatureToPatent(feature, patent);
    return {
      feature,
      publicationNumber: patent.publicationNumber,
      matchType: existing.matchType,
      matchedKeywords: [...existing.matchedKeywords],
      matchedConcepts: [...(existing.matchedConcepts ?? [])],
      missingConcepts: [...(existing.missingConcepts ?? [])],
      explanation: existing.explanation,
    };
  }));

  const patentSummaries = patents.map((_, patentIndex) => cells.reduce((summary, row) => {
    summary[row[patentIndex].matchType] += 1;
    return summary;
  }, emptyPatentSummary()));

  const featureSummaries = features.map((feature, featureIndex) => {
    const row = cells[featureIndex];
    const strongestMatch = row.reduce<OverlapMatchType>((strongest, cell) => (
      MATCH_STRENGTH[cell.matchType] > MATCH_STRENGTH[strongest] ? cell.matchType : strongest
    ), "NOT_FOUND");
    return {
      feature,
      strongestMatch,
      matchingPatentCount: row.filter((cell) => cell.matchType === "FULL" || cell.matchType === "PARTIAL").length,
    };
  });

  return { cells, patentSummaries, featureSummaries };
}

export function updatePatentSelection(current: string[], patentId: string, selected: boolean, maximum = 5) {
  if (!selected) return { selection: current.filter((id) => id !== patentId), limitReached: false };
  if (current.includes(patentId)) return { selection: current, limitReached: false };
  if (current.length >= maximum) return { selection: current, limitReached: true };
  return { selection: [...current, patentId], limitReached: false };
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function searchTimestamp(search: CompletedPatentSearchCandidate): number {
  return timestamp(search.completedAt) ?? timestamp(search.createdAt) ?? Number.NEGATIVE_INFINITY;
}

export function selectLatestCompletedPatentSearch<T extends CompletedPatentSearchCandidate>(
  searches: T[],
  currentFeatureSetVersion: number,
): T | null {
  return searches
    .filter((search) => search.status === "COMPLETED" && search.featureSetVersion === currentFeatureSetVersion)
    .map((search, index) => ({ search, index }))
    .sort((left, right) => {
      const completionOrder = searchTimestamp(right.search) - searchTimestamp(left.search);
      if (completionOrder) return completionOrder;
      const creationOrder = (timestamp(right.search.createdAt) ?? Number.NEGATIVE_INFINITY)
        - (timestamp(left.search.createdAt) ?? Number.NEGATIVE_INFINITY);
      return creationOrder || left.search.id.localeCompare(right.search.id, "en") || left.index - right.index;
    })[0]?.search ?? null;
}

export function defaultPatentSelection(patents: SelectablePatent[], maximum = 3): string[] {
  return patents
    .map((patent, index) => ({ patent, index }))
    .sort((left, right) => (right.patent.relevanceScore ?? Number.NEGATIVE_INFINITY)
      - (left.patent.relevanceScore ?? Number.NEGATIVE_INFINITY) || left.index - right.index)
    .slice(0, maximum)
    .map(({ patent }) => patent.id);
}

export function reconcilePatentSelection(
  selectedIds: string[],
  patents: SelectablePatent[],
  sourceChanged: boolean,
): { selection: string[]; removedMissing: boolean } {
  if (sourceChanged) return { selection: defaultPatentSelection(patents), removedMissing: selectedIds.length > 0 };
  const availableIds = new Set(patents.map((patent) => patent.id));
  const selection = selectedIds.filter((id) => availableIds.has(id));
  return { selection, removedMissing: selection.length !== selectedIds.length };
}

export function isPatentComparisonStale(searchFeatureSetVersion: number, currentFeatureSetVersion: number) {
  return searchFeatureSetVersion !== currentFeatureSetVersion;
}
