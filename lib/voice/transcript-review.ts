export type TranscriptWarning = "DUPLICATE" | "MISSING_PUNCTUATION" | "INCOMPLETE";

function normalized(value: string): string {
  return value.toLocaleLowerCase("en").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalized(value).split(" ").filter((word) => word.length > 2));
}

export function transcriptWarnings(existingText: string, transcript: string): TranscriptWarning[] {
  const warnings: TranscriptWarning[] = [];
  const existing = normalized(existingText);
  const candidate = normalized(transcript);
  const candidateTokens = tokens(transcript);
  const existingTokens = tokens(existingText);
  const common = [...candidateTokens].filter((token) => existingTokens.has(token)).length;
  const containment = common / Math.max(1, candidateTokens.size);
  if (candidate && (existing.includes(candidate) || containment >= .55)) warnings.push("DUPLICATE");
  if (transcript.trim() && !/[.!?।]$/.test(transcript.trim())) warnings.push("MISSING_PUNCTUATION");
  if (candidate.split(" ").length < 4 || /\b(?:and|because|with|to|for|that)$/i.test(candidate)) warnings.push("INCOMPLETE");
  return warnings;
}

export function normalizeGeneratedSentence(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean && !/[.!?।]$/.test(clean) ? `${clean}.` : clean;
}

export function uniqueSentences(value: string, alreadyUsed = ""): string {
  const used = (alreadyUsed.match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g) ?? []).map(normalized).filter(Boolean);
  const sentences = value.match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g) ?? [];
  return sentences.map(normalizeGeneratedSentence).filter((item) => {
    const key = normalized(item);
    if (!key) return false;
    const candidateTokens = tokens(key);
    const repeated = used.some((prior) => {
      if (prior === key || prior.includes(key) || key.includes(prior)) return true;
      const priorTokens = tokens(prior);
      const common = [...candidateTokens].filter((token) => priorTokens.has(token)).length;
      return common / Math.max(1, Math.min(candidateTokens.size, priorTokens.size)) >= .55;
    });
    if (repeated) return false;
    used.push(key);
    return true;
  }).join(" ");
}
