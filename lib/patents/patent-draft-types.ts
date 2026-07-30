import type { FeatureOverlapMatch, OverlapSummary } from "@/lib/patents/overlap-types";
import type { PatentSearchResult } from "@/lib/patents/patent-search";
import type { PatentDraftFigure } from "@/lib/patents/patent-draft-drawings";

export const PATENT_DRAFT_SECTION_KEYS = [
  "title",
  "technicalField",
  "background",
  "problemStatement",
  "summaryOfInvention",
  "detailedDescription",
  "briefDescriptionOfDrawings",
  "essentialFeatures",
  "exampleImplementation",
  "preliminaryClaims",
  "abstract",
] as const;

export type PatentDraftSectionKey = typeof PATENT_DRAFT_SECTION_KEYS[number];

export type PatentDraftSections = Record<PatentDraftSectionKey, string>;

export type PatentDraftInput = {
  title: string;
  problemStatement: string;
  description: string;
  noveltyDescription: string;
  clarificationAnswers: Array<{ question: string; answer: string }>;
  developmentStage: string;
  publiclyDisclosed: boolean;
  previouslySold: boolean;
  previouslyFiled: boolean;
  technicalField: string;
  approvedFeatures: string[];
  patentResults: PatentSearchResult[];
  overlapSummary: OverlapSummary;
  overlapMatches: FeatureOverlapMatch[];
  figures: PatentDraftFigure[];
};
