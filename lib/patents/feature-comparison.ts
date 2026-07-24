import type { FeatureOverlapMatch, OverlapMatchType } from "@/lib/patents/overlap-types";

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

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "in", "into", "is", "it", "of", "on", "or", "that", "the",
  "this", "to", "using", "with", "within",
]);
const MATCH_STRENGTH: Record<OverlapMatchType, number> = {
  FULL: 4,
  PARTIAL: 3,
  UNCERTAIN: 2,
  NOT_FOUND: 1,
};

function keywords(value: string): string[] {
  const words = value.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words.filter((word) => word.length > 2 && !STOP_WORDS.has(word)))];
}

function explanation(matchType: OverlapMatchType, matched: number, total: number): string {
  switch (matchType) {
    case "FULL":
      return `${matched} of ${total} significant feature keywords appear in this patent record.`;
    case "PARTIAL":
      return `${matched} of ${total} significant feature keywords appear, indicating partial textual overlap.`;
    case "UNCERTAIN":
      return total < 2
        ? "The feature or patent text contains too few specific keywords for a reliable comparison."
        : `Only ${matched} of ${total} significant feature keywords appear; the available wording is too limited for a reliable match.`;
    case "NOT_FOUND":
      return "No significant feature keywords were found in this patent title or abstract.";
  }
}

export function compareFeatureToPatent(feature: string, patent: ComparisonPatent): ComparisonCell {
  const featureKeywords = keywords(feature);
  const patentKeywords = new Set(keywords(`${patent.title} ${patent.abstract ?? ""}`));

  if (featureKeywords.length < 2 || patentKeywords.size < 2) {
    return {
      feature,
      publicationNumber: patent.publicationNumber,
      matchType: "UNCERTAIN",
      matchedKeywords: featureKeywords.filter((word) => patentKeywords.has(word)),
      explanation: explanation("UNCERTAIN", 0, Math.min(featureKeywords.length, patentKeywords.size)),
    };
  }

  const matchedKeywords = featureKeywords.filter((word) => patentKeywords.has(word));
  if (matchedKeywords.length === 0) {
    return {
      feature,
      publicationNumber: patent.publicationNumber,
      matchType: "NOT_FOUND",
      matchedKeywords,
      explanation: explanation("NOT_FOUND", 0, featureKeywords.length),
    };
  }

  const coverage = matchedKeywords.length / featureKeywords.length;
  const matchType: OverlapMatchType = coverage >= 0.75
    ? "FULL"
    : coverage >= 0.3
      ? "PARTIAL"
      : "UNCERTAIN";

  return {
    feature,
    publicationNumber: patent.publicationNumber,
    matchType,
    matchedKeywords,
    explanation: explanation(matchType, matchedKeywords.length, featureKeywords.length),
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

export function isPatentComparisonStale(searchFeatureSetVersion: number, currentFeatureSetVersion: number) {
  return searchFeatureSetVersion !== currentFeatureSetVersion;
}
