export type OverlapMatchType = "FULL" | "PARTIAL" | "NOT_FOUND" | "UNCERTAIN";

export type OverlapSummaryType =
  | "HIGH_CONFLICT"
  | "PARTIAL_OVERLAP"
  | "LOW_OVERLAP"
  | "INSUFFICIENT_INFORMATION";

export type FeatureOverlapMatch = {
  feature: string;
  matchedPatentTitle: string | null;
  publicationNumber: string | null;
  matchType: OverlapMatchType;
  matchedKeywords: string[];
  explanation: string;
};

export type OverlapSummary = {
  classification: OverlapSummaryType;
  fullMatches: number;
  partialMatches: number;
  notFound: number;
  uncertain: number;
};

export type OverlapReport = {
  summary: OverlapSummary;
  featureMatches: FeatureOverlapMatch[];
};

export type OverlapPatent = {
  title: string;
  publicationNumber: string;
  abstract: string | null;
};
