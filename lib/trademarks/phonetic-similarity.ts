import { normalizeTrademarkName } from "./normalization";
import type { TrademarkSimilarityCandidate } from "./types";
import { levenshteinDistance } from "./visual-similarity";

export function phoneticKey(value: string) {
  return normalizeTrademarkName(value).compactName
    .replace(/ph/g, "f").replace(/x/g, "ks").replace(/q/g, "k").replace(/c(?=[eiy])/g, "s").replace(/c/g, "k")
    .replace(/z/g, "s").replace(/ee/g, "i").replace(/y/g, "i").replace(/(.)\1+/g, "$1").replace(/e$/g, "");
}
export function phoneticSimilarity(a: string, b: string) { const left = phoneticKey(a); const right = phoneticKey(b); if (!left || !right) return 0; if (left === right) return 100; return Math.max(0, Math.round((1 - levenshteinDistance(left, right) / Math.max(left.length, right.length)) * 100)); }

export function generatePhoneticCandidates(name: string): TrademarkSimilarityCandidate[] {
  const compact = normalizeTrademarkName(name).compactName; if (compact.length < 2) return [];
  const variants = new Map<string, string>(); const add = (value: string, reason: string) => { if (value && value !== compact) variants.set(value, reason); };
  if (compact.endsWith("sense")) { const root = compact.slice(0, -5); add(`${root}sens`, "Silent final-e variation"); add(`${root}cense`, "s/c sound variation"); add(`${root}senze`, "s/z sound variation"); }
  if (compact.includes("ph")) add(compact.replace(/ph/g, "f"), "ph/f sound variation");
  if (compact.includes("f")) add(compact.replace(/f/g, "ph"), "f/ph sound variation");
  if (compact.includes("k")) add(compact.replace(/k/g, "c"), "k/c sound variation");
  if (compact.includes("c")) add(compact.replace(/c/g, "k"), "c/k sound variation");
  add(compact.replace(/(.)\1+/g, "$1"), "Repeated-letter variation");
  return [...variants].slice(0, 15).map(([candidate, reason]) => ({ name: candidate[0].toUpperCase() + candidate.slice(1), source: "DETERMINISTIC" as const, similarityScore: phoneticSimilarity(name, candidate), reasons: [reason], verifiedConflict: false as const })).sort((a, b) => b.similarityScore - a.similarityScore);
}
