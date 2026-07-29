import { normalizeTrademarkName } from "./normalization";
import type { TrademarkSimilarityCandidate } from "./types";

export function levenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function ngrams(value: string, size = 2) { const result = new Set<string>(); for (let index = 0; index <= value.length - size; index += 1) result.add(value.slice(index, index + size)); return result; }
export function visualSimilarity(a: string, b: string) {
  const left = normalizeTrademarkName(a); const right = normalizeTrademarkName(b);
  if (!left.compactName || !right.compactName) return 0;
  if (left.compactName === right.compactName) return 100;
  const edit = 1 - levenshteinDistance(left.compactName, right.compactName) / Math.max(left.compactName.length, right.compactName.length);
  const x = ngrams(left.compactName); const y = ngrams(right.compactName); const overlap = [...x].filter((item) => y.has(item)).length; const dice = x.size + y.size ? 2 * overlap / (x.size + y.size) : 0;
  const prefix = Math.min(4, [...left.compactName].findIndex((character, index) => character !== right.compactName[index]));
  return Math.max(0, Math.min(100, Math.round(edit * 65 + dice * 30 + (prefix >= 3 ? 5 : 0))));
}

export function generateVisualCandidates(name: string): TrademarkSimilarityCandidate[] {
  const normalized = normalizeTrademarkName(name); const compact = normalized.compactName; if (compact.length < 2) return [];
  const values = new Set<string>();
  values.add(normalized.tokens.join(" ")); values.add(compact);
  if (compact.endsWith("sense")) { const root = compact.slice(0, -5); values.add(`${root}sence`); values.add(`${root}sens`); values.add(`${root} cense`); values.add(`${root} sense`); }
  if (compact.length > 4) { values.add(compact.slice(0, -1)); values.add(`${compact.slice(0, -2)}${compact.at(-1)}${compact.at(-2)}`); }
  values.add(compact.replace(/([a-z])\1+/g, "$1"));
  const title = (value: string) => value.split(" ").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
  return [...values].filter((value) => value && value !== normalized.normalizedName).slice(0, 15).map((value) => {
    const score = visualSimilarity(name, value); const reasons = normalizeTrademarkName(value).compactName === compact ? ["Spacing or punctuation variation"] : [levenshteinDistance(compact, normalizeTrademarkName(value).compactName) === 1 ? "Single-letter spelling variation" : "Similar spelling structure"];
    return { name: title(value), source: "DETERMINISTIC" as const, similarityScore: score, reasons, verifiedConflict: false as const };
  }).sort((a, b) => b.similarityScore - a.similarityScore);
}
