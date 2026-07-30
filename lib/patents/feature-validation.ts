import { z } from "zod";

export const FEATURE_BOILERPLATE = [
  "primary assembly",
  "central function",
  "cooperating components",
  "unified structure",
  "defined sequence",
  "intended result",
] as const;

export type FeatureDuplicateFinding = {
  index: number;
  duplicateOf: number[];
  kind: "EXACT" | "LIKELY";
  reason: string;
};

const STOP_WORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "into", "is", "of", "on", "only", "or", "the", "to", "with", "when", "that", "this"]);
const CONCEPT_GROUPS = [
  /(?:pill|medicine|medication).{0,30}compartment|compartment.{0,30}(?:pill|medicine|medication)/,
  /schedul.{0,35}(?:unlock|access)|(?:unlock|access).{0,35}schedul/,
  /visual.{0,25}(?:reminder|alert|indicat)|(?:reminder|alert|indicat).{0,25}visual/,
  /audible|audio reminder|sound alert/,
  /(?:compartment|door).{0,30}open.{0,20}(?:detect|check)|(?:detect|check).{0,30}(?:compartment|door).{0,20}open/,
  /missed.{0,25}(?:dose|record)|(?:dose|event).{0,25}record/,
  /offline|without.{0,25}(?:internet|cloud|network)/,
] as const;

export function normalizeFeatureText(value: string): string {
  return value.toLocaleLowerCase("en").normalize("NFKC").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function featureTokens(value: string): Set<string> {
  return new Set(normalizeFeatureText(value).split(" ").filter((token) => token.length > 2 && !STOP_WORDS.has(token)).map((token) => token.replace(/(?:ing|ed|es|s)$/i, "")));
}

function overlap(left: Set<string>, right: Set<string>): { containment: number; jaccard: number } {
  const common = [...left].filter((token) => right.has(token)).length;
  return {
    containment: common / Math.max(1, Math.min(left.size, right.size)),
    jaccard: common / Math.max(1, new Set([...left, ...right]).size),
  };
}

function concepts(value: string): number[] {
  const normalized = normalizeFeatureText(value);
  return CONCEPT_GROUPS.flatMap((pattern, index) => pattern.test(normalized) ? [index] : []);
}

export function findFeatureDuplicates(features: string[]): FeatureDuplicateFinding[] {
  const findings: FeatureDuplicateFinding[] = [];
  for (let index = 0; index < features.length; index += 1) {
    const normalized = normalizeFeatureText(features[index]);
    if (!normalized) continue;
    const exact = features.slice(0, index).findIndex((feature) => normalizeFeatureText(feature) === normalized);
    if (exact >= 0) {
      findings.push({ index, duplicateOf: [exact], kind: "EXACT", reason: `Duplicates feature ${exact + 1} after punctuation and spacing are normalised.` });
      continue;
    }
    const tokens = featureTokens(features[index]);
    const likely = features.slice(0, index).flatMap((feature, priorIndex) => {
      const priorNormalized = normalizeFeatureText(feature);
      const score = overlap(tokens, featureTokens(feature));
      return normalized.includes(priorNormalized) || priorNormalized.includes(normalized) || score.containment >= .8 || score.jaccard >= .68 ? [priorIndex] : [];
    });
    const currentConcepts = concepts(features[index]);
    const priorConceptMatches = features.slice(0, index).flatMap((feature, priorIndex) => concepts(feature).some((concept) => currentConcepts.includes(concept)) ? [priorIndex] : []);
    const combinedConceptDuplicate = currentConcepts.length >= 2 && new Set(priorConceptMatches.flatMap((priorIndex) => concepts(features[priorIndex]))).size >= currentConcepts.length;
    const duplicateOf = [...new Set(combinedConceptDuplicate ? [...likely, ...priorConceptMatches] : likely)];
    if (duplicateOf.length) findings.push({
      index,
      duplicateOf,
      kind: "LIKELY",
      reason: combinedConceptDuplicate
        ? `Combines concepts already covered by features ${duplicateOf.map((item) => item + 1).join(", ")}.`
        : `Likely overlaps feature ${duplicateOf.map((item) => item + 1).join(", ")} by wording, containment, or token similarity.`,
    });
  }
  return findings;
}

const baseFeatureSetSchema = z
  .array(z.string().trim().min(10, "Each feature must contain at least 10 characters.").max(500, "Each feature must contain no more than 500 characters."))
  .min(1, "Add at least one feature.")
  .max(10, "Use no more than 10 features.");

export function validateFeatureSet(features: unknown, sourceText: string) {
  const result = baseFeatureSetSchema.safeParse(features);
  if (!result.success) return result;

  const exactDuplicate = findFeatureDuplicates(result.data).find((finding) => finding.kind === "EXACT");
  if (exactDuplicate) return {
    success: false as const,
    error: new z.ZodError([{ code: "custom", message: `Feature ${exactDuplicate.index + 1} duplicates feature ${exactDuplicate.duplicateOf[0] + 1}. Remove or merge it before approval.`, path: [exactDuplicate.index] }]),
  };

  const normalizedSource = sourceText.toLocaleLowerCase("en").replace(/\s+/g, " ");
  const boilerplateFeature = result.data.find((feature) => {
    const normalizedFeature = feature.toLocaleLowerCase("en").replace(/\s+/g, " ");
    return FEATURE_BOILERPLATE.some((phrase) => normalizedFeature.includes(phrase) && !normalizedSource.includes(phrase));
  });

  if (boilerplateFeature) {
    return {
      success: false as const,
      error: new z.ZodError([{
        code: "custom",
        message: "Remove generic boilerplate unless that exact concept appears in the stored invention information.",
        path: [result.data.indexOf(boilerplateFeature)],
      }]),
    };
  }

  return result;
}
