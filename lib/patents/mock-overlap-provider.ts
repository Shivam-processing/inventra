import "server-only";

import { compareConceptGroups } from "@/lib/patents/concept-matching";
import type {
  FeatureOverlapMatch,
  OverlapPatent,
  OverlapReport,
  OverlapSummaryType,
} from "@/lib/patents/overlap-types";

function compareFeature(feature: string, patents: OverlapPatent[]): FeatureOverlapMatch {
  const comparisons = patents.map((patent) => {
    const result = compareConceptGroups(feature, patent.title, patent.abstract);
    const titleEvidence = result.matchedEvidence.filter((term) => patent.title.toLocaleLowerCase("en").includes(term)).length;
    return { patent, result, score: result.coverage * 100 + result.matchedConcepts.length * 10 + titleEvidence + (patent.abstract ? 1 : 0) };
  });

  comparisons.sort((left, right) => right.score - left.score);
  const best = comparisons[0];

  if (!best) {
    return {
      feature,
      matchedPatentTitle: null,
      publicationNumber: null,
      matchType: "NOT_FOUND",
      matchedKeywords: [],
      matchedConcepts: [],
      missingConcepts: [],
      explanation: "No patent title or abstract was available for deterministic concept comparison.",
    };
  }

  return {
    feature,
    matchedPatentTitle: best.result.matchedEvidence.length || best.result.matchType === "UNCERTAIN" ? best.patent.title : null,
    publicationNumber: best.result.matchedEvidence.length || best.result.matchType === "UNCERTAIN" ? best.patent.publicationNumber : null,
    matchType: best.result.matchType,
    matchedKeywords: best.result.matchedEvidence,
    matchedConcepts: best.result.matchedConcepts,
    missingConcepts: best.result.missingConcepts,
    explanation: best.result.explanation,
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
