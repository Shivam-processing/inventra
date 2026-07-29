import { suggestNiceClassesFromContext, type NiceClassSuggestion } from "./nice-classes";
import type { TrademarkHistoryItem, TrademarkResult } from "./types";

export const DEFAULT_TRADEMARK_MODE = "GUIDED" as const;

export const distinctivenessLabels = {
  GENERIC_OR_COMMON: "Common or generic wording",
  DESCRIPTIVE: "Possibly descriptive",
  SUGGESTIVE: "Suggestive",
  ARBITRARY: "Arbitrary",
  FANCIFUL_OR_COINED: "Coined or fanciful",
  UNCERTAIN: "Uncertain",
} as const;

export function trademarkResultMetrics(result: TrademarkResult) {
  const generated = [...result.visualCandidates, ...result.phoneticCandidates];
  const hasOfficialEvidence = result.conflicts.some((item) => item.verificationStatus === "VERIFIED_OFFICIAL");
  return {
    generatedCandidateCount: generated.length,
    strongestGeneratedSimilarity: generated.length ? Math.max(...generated.map((item) => item.similarityScore)) : null,
    goodsServicesOverlap: hasOfficialEvidence ? result.risk.goodsServicesOverlap : null,
    officialVerificationConfidence: hasOfficialEvidence ? result.risk.officialVerificationConfidence : null,
    hasOfficialEvidence,
  };
}

export function relatedClassSuggestions(result: TrademarkResult, context: string): NiceClassSuggestion[] {
  const combinedContext = `${result.input.goodsServicesDescription} ${context}`;
  const serviceContext = /\b(hosted|saas|software as a service|online (?:software|monitoring)|technical service|cloud service)\b/i.test(combinedContext);
  const deterministic = suggestNiceClassesFromContext(combinedContext, result.input.niceClass);
  const provider = result.aiAnalysis.relatedClassSuggestions
    .filter((item) => item.niceClass !== result.input.niceClass && (item.niceClass !== 42 || serviceContext))
    .map((item) => ({ ...item, confidence: "REVIEW_NEEDED" as const }));
  return [...deterministic, ...provider]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.niceClass === item.niceClass) === index)
    .slice(0, 6);
}

export function historyEntryCount(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

export function compactHistoryPreview(history: TrademarkHistoryItem[]) {
  return history[0] ?? null;
}
