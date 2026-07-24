import "server-only";

import type {
  FeatureOverlapMatch,
  OverlapMatchType,
  OverlapPatent,
  OverlapReport,
  OverlapSummaryType,
} from "@/lib/patents/overlap-types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "in", "into", "is", "it", "of", "on", "or", "that", "the",
  "this", "to", "using", "with", "within",
]);

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
      return matched
        ? `Only ${matched} of ${total} significant feature keywords appear; the wording is too limited for a reliable match.`
        : "The feature contains too few specific keywords for a reliable comparison.";
    case "NOT_FOUND":
      return "No significant feature keywords were found in the searched patent titles or abstracts.";
  }
}

function compareFeature(feature: string, patents: OverlapPatent[]): FeatureOverlapMatch {
  const featureKeywords = keywords(feature);

  if (featureKeywords.length < 2) {
    return {
      feature,
      matchedPatentTitle: null,
      publicationNumber: null,
      matchType: "UNCERTAIN",
      matchedKeywords: [],
      explanation: explanation("UNCERTAIN", 0, featureKeywords.length),
    };
  }

  const comparisons = patents.map((patent) => {
    const titleKeywords = new Set(keywords(patent.title));
    const patentKeywords = new Set(keywords(`${patent.title} ${patent.abstract ?? ""}`));
    const matchedKeywords = featureKeywords.filter((word) => patentKeywords.has(word));
    const titleMatches = matchedKeywords.filter((word) => titleKeywords.has(word)).length;
    return {
      patent,
      matchedKeywords,
      coverage: matchedKeywords.length / featureKeywords.length,
      score: matchedKeywords.length / featureKeywords.length + titleMatches * 0.02,
    };
  });

  comparisons.sort((left, right) => right.score - left.score);
  const best = comparisons[0];

  if (!best || best.matchedKeywords.length === 0) {
    return {
      feature,
      matchedPatentTitle: null,
      publicationNumber: null,
      matchType: "NOT_FOUND",
      matchedKeywords: [],
      explanation: explanation("NOT_FOUND", 0, featureKeywords.length),
    };
  }

  const matchType: OverlapMatchType = best.coverage >= 0.75
    ? "FULL"
    : best.coverage >= 0.3
      ? "PARTIAL"
      : "UNCERTAIN";

  return {
    feature,
    matchedPatentTitle: best.patent.title,
    publicationNumber: best.patent.publicationNumber,
    matchType,
    matchedKeywords: best.matchedKeywords,
    explanation: explanation(matchType, best.matchedKeywords.length, featureKeywords.length),
  };
}

function summarize(matches: FeatureOverlapMatch[], patentCount: number): OverlapSummaryType {
  if (!matches.length || patentCount === 0) return "INSUFFICIENT_INFORMATION";

  const fullMatches = matches.filter((match) => match.matchType === "FULL").length;
  const partialMatches = matches.filter((match) => match.matchType === "PARTIAL").length;
  const uncertain = matches.filter((match) => match.matchType === "UNCERTAIN").length;

  if (fullMatches >= Math.ceil(matches.length / 2)) return "HIGH_CONFLICT";
  if (fullMatches > 0 || partialMatches > 0) return "PARTIAL_OVERLAP";
  if (uncertain > 0) return "INSUFFICIENT_INFORMATION";
  return "LOW_OVERLAP";
}

export class MockOverlapProvider {
  async generate(features: string[], patents: OverlapPatent[]): Promise<OverlapReport> {
    const featureMatches = features.map((feature) => compareFeature(feature, patents));

    return {
      summary: {
        classification: summarize(featureMatches, patents.length),
        fullMatches: featureMatches.filter((match) => match.matchType === "FULL").length,
        partialMatches: featureMatches.filter((match) => match.matchType === "PARTIAL").length,
        notFound: featureMatches.filter((match) => match.matchType === "NOT_FOUND").length,
        uncertain: featureMatches.filter((match) => match.matchType === "UNCERTAIN").length,
      },
      featureMatches,
    };
  }
}
