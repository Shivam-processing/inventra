import { z } from "zod";
import type { FeatureOverlapMatch, OverlapMatchType } from "@/lib/patents/overlap-types";
import type { PatentSearchResult } from "@/lib/patents/patent-search";

export const FULL_REPORT_DISCLAIMER = "This report is a preliminary automated assessment and does not constitute legal advice, a legal opinion, a patentability determination, or a filed patent application. Search results may be incomplete, and deterministic feature matching cannot determine novelty, inventive step, or legal validity. Consult a qualified patent professional before filing or making legal or commercial decisions.";
export const OVERLAP_SCORE_CAVEAT = "This score reflects deterministic textual overlap in the searched records. It is not a patentability, novelty, or legal opinion.";

export const fullReportRequestSchema = z.object({ inventionId: z.string().uuid() }).strict();

export function authenticatedUserId(claimsError: unknown, subject: unknown): string | null {
  return !claimsError && typeof subject === "string" && subject.length > 0 ? subject : null;
}

const matchWeights: Record<OverlapMatchType, number> = {
  FULL: 100,
  PARTIAL: 60,
  UNCERTAIN: 30,
  NOT_FOUND: 0,
};

export type MatchCounts = Record<OverlapMatchType, number>;

export function aggregateMatchStatuses(matches: FeatureOverlapMatch[]): MatchCounts {
  return matches.reduce<MatchCounts>((counts, match) => {
    counts[match.matchType] += 1;
    return counts;
  }, { FULL: 0, PARTIAL: 0, NOT_FOUND: 0, UNCERTAIN: 0 });
}

export function calculateOverlapRiskScore(matches: FeatureOverlapMatch[]): number {
  if (!matches.length) return 0;
  const score = matches.reduce((total, match) => total + matchWeights[match.matchType], 0) / matches.length;
  return Math.round(score);
}

export function overlapRiskLevel(matches: FeatureOverlapMatch[]): "High" | "Moderate" | "Low" | "Insufficient information" {
  if (!matches.length || matches.every((match) => match.matchType === "UNCERTAIN")) return "Insufficient information";
  const score = calculateOverlapRiskScore(matches);
  if (score >= 70) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

export function overlapFeatureExtremes(matches: FeatureOverlapMatch[]): { strongest: string; lowest: string } {
  if (!matches.length) return { strongest: "Not provided", lowest: "Not provided" };
  const ranked = matches.map((match, index) => ({ feature: match.feature, weight: matchWeights[match.matchType], index }));
  const strongest = ranked.reduce((best, item) => item.weight > best.weight ? item : best);
  const lowestWeight = Math.min(...ranked.map((item) => item.weight));
  const lowestFeatures = ranked.filter((item) => item.weight === lowestWeight).map((item) => item.feature).filter(Boolean);
  return {
    strongest: strongest.feature || "Not provided",
    lowest: lowestFeatures.length === 1 ? lowestFeatures[0] : lowestFeatures.slice(0, 3).join("; ") || "No uniquely lowest-overlap feature",
  };
}

export function strongestPatentMatch(publicationNumber: string, matches: FeatureOverlapMatch[], totalFeatures: number): OverlapMatchType | "NOT_ASSESSED" {
  const related = matches.filter((match) => match.publicationNumber === publicationNumber);
  if (!totalFeatures || related.length < totalFeatures) return "NOT_ASSESSED";
  return related.reduce<OverlapMatchType>((best, match) => matchWeights[match.matchType] > matchWeights[best] ? match.matchType : best, "NOT_FOUND");
}

export function aggregatePatentAssessments(publicationNumbers: string[], matches: FeatureOverlapMatch[], totalFeatures: number) {
  const counts = { FULL: 0, PARTIAL: 0, NOT_FOUND: 0, UNCERTAIN: 0, NOT_ASSESSED: 0 };
  publicationNumbers.forEach((publicationNumber) => {
    const status = strongestPatentMatch(publicationNumber, matches, totalFeatures);
    counts[status] += 1;
  });
  return { counts, fullyAssessed: counts.NOT_ASSESSED === 0 && publicationNumbers.length > 0 };
}

export function sanitizePdfText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF\uFFFD]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function reportFilename(title: string, draftVersion: number): string {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "") || "invention";
  return `${safeTitle}-inventra-analysis-v${Math.max(1, Math.trunc(draftVersion))}.pdf`;
}

function stableSuffix(seed: string): string {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 4);
}

export function createReportCode(date: Date, seed: string): string {
  const stamp = Number.isNaN(date.valueOf()) ? "00000000" : date.toISOString().slice(0, 10).replaceAll("-", "");
  return `INV-${stamp}-${stableSuffix(seed)}`;
}

export function abstractExcerpt(value: string | null): string {
  if (!value?.trim()) return "Not provided";
  const sentences = value.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  return sentences.slice(0, 3).join(" ").slice(0, 900).trim() || "Not provided";
}

export function deterministicNextSteps(matches: FeatureOverlapMatch[]): string[] {
  const counts = aggregateMatchStatuses(matches);
  const steps: string[] = [];
  if (counts.FULL || counts.PARTIAL) steps.push("Review the strongest textual overlaps with a qualified patent professional.");
  if (counts.UNCERTAIN) steps.push("Obtain fuller source text for comparisons currently marked uncertain.");
  steps.push("Confirm the saved technical description and preliminary claims before relying on this report.");
  if (steps.length < 3) steps.push("Consider a broader professional prior-art search before filing or commercial decisions.");
  return steps.slice(0, 3);
}

export type WorkflowRecord = {
  id: string;
  invention_id: string;
  user_id: string;
  feature_set_version: number;
};

export function validateCurrentReportWorkflow(input: {
  inventionId: string;
  userId: string;
  featureSetVersion: number;
  search: WorkflowRecord;
  report: WorkflowRecord & { patent_search_id: string };
  draft: WorkflowRecord & { patent_search_id: string; overlap_report_id: string };
}): boolean {
  const { inventionId, userId, featureSetVersion, search, report, draft } = input;
  return [search, report, draft].every((record) =>
    record.invention_id === inventionId
    && record.user_id === userId
    && record.feature_set_version === featureSetVersion)
    && report.patent_search_id === search.id
    && draft.patent_search_id === search.id
    && draft.overlap_report_id === report.id;
}

export function fullReportResponseHeaders(filename: string, byteLength?: number): HeadersInit {
  return {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="${filename}"`,
    ...(byteLength === undefined ? {} : { "Content-Length": String(byteLength) }),
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
  };
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parsePatentResults(value: unknown): PatentSearchResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    const title = nullableText(source.title);
    const publicationNumber = nullableText(source.publicationNumber);
    if (!title || !publicationNumber) return [];
    return [{
      title,
      publicationNumber,
      priorityDate: nullableText(source.priorityDate),
      publicationDate: nullableText(source.publicationDate),
      applicant: nullableText(source.applicant),
      abstract: nullableText(source.abstract),
      sourceId: nullableText(source.sourceId) ?? publicationNumber,
      sourceUrl: nullableText(source.sourceUrl) ?? "",
      relevanceScore: typeof source.relevanceScore === "number" ? source.relevanceScore : undefined,
      searchMode: source.searchMode === "strict" || source.searchMode === "fallback" ? source.searchMode : undefined,
    }];
  });
}

const matchTypes = new Set<OverlapMatchType>(["FULL", "PARTIAL", "NOT_FOUND", "UNCERTAIN"]);

export function parseOverlapMatches(value: unknown): FeatureOverlapMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    const feature = nullableText(source.feature);
    const matchType = nullableText(source.matchType) as OverlapMatchType | null;
    if (!feature || !matchType || !matchTypes.has(matchType)) return [];
    return [{
      feature,
      matchedPatentTitle: nullableText(source.matchedPatentTitle),
      publicationNumber: nullableText(source.publicationNumber),
      matchType,
      matchedKeywords: Array.isArray(source.matchedKeywords)
        ? source.matchedKeywords.filter((word): word is string => typeof word === "string" && Boolean(word.trim())).map((word) => word.trim())
        : [],
      matchedConcepts: Array.isArray(source.matchedConcepts) ? source.matchedConcepts.filter((word): word is string => typeof word === "string" && Boolean(word.trim())).map((word) => word.trim()) : [],
      missingConcepts: Array.isArray(source.missingConcepts) ? source.missingConcepts.filter((word): word is string => typeof word === "string" && Boolean(word.trim())).map((word) => word.trim()) : [],
      explanation: nullableText(source.explanation) ?? "Not provided",
    }];
  });
}
