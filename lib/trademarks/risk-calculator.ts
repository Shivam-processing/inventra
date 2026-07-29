import type { TrademarkConflictCandidate, TrademarkRiskAssessment, TrademarkSimilarityCandidate } from "./types";

export function calculateTrademarkRisk(input: { niceClass: number; visualCandidates: TrademarkSimilarityCandidate[]; phoneticCandidates: TrademarkSimilarityCandidate[]; conflicts: TrademarkConflictCandidate[]; discoveryPerformed: boolean }): TrademarkRiskAssessment {
  const verified = input.conflicts.filter((item) => item.verificationStatus === "VERIFIED_OFFICIAL");
  const exactSameClass = verified.some((item) => item.similarityTypes.includes("IDENTICAL") && item.niceClasses.includes(input.niceClass));
  const strongVerified = verified.some((item) => item.combinedSimilarityScore >= 85 && item.niceClasses.includes(input.niceClass));
  const generatedNameScore = Math.max(0, ...input.visualCandidates.map((item) => item.similarityScore), ...input.phoneticCandidates.map((item) => item.similarityScore));
  const officialNameScore = Math.max(0, ...verified.map((item) => item.combinedSimilarityScore));
  const sameClass = verified.filter((item) => item.niceClasses.includes(input.niceClass));
  const goodsServicesOverlap = sameClass.length ? Math.max(...sameClass.map((item) => item.goodsServices ? 90 : 65)) : 0;
  const officialVerificationConfidence = verified.length ? Math.min(100, 70 + verified.length * 10) : input.discoveryPerformed ? 20 : 0;
  if (exactSameClass || strongVerified) return { overallStatus: "HIGH_PRELIMINARY_CONFLICT", nameSimilarity: Math.max(generatedNameScore, officialNameScore), goodsServicesOverlap, officialVerificationConfidence, explanation: "Official-source evidence indicates an identical or very similar mark in the same class. Professional review is required." };
  if (verified.some((item) => item.combinedSimilarityScore >= 55)) return { overallStatus: "POTENTIAL_CONFLICT", nameSimilarity: Math.max(generatedNameScore, officialNameScore), goodsServicesOverlap, officialVerificationConfidence, explanation: "Official-source similarity signals require complete registry and professional review." };
  if (!input.discoveryPerformed) return { overallStatus: "INSUFFICIENT_VERIFICATION", nameSimilarity: generatedNameScore, goodsServicesOverlap: 0, officialVerificationConfidence: 0, explanation: "No live registry discovery was performed. Complete official verification before filing or use." };
  return { overallStatus: "LOWER_PRELIMINARY_RISK", nameSimilarity: Math.max(generatedNameScore, officialNameScore), goodsServicesOverlap, officialVerificationConfidence, explanation: "No strong conflict was identified in the limited evidence checked. This does not confirm availability and official registry review is still required." };
}
