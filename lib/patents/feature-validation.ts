import { z } from "zod";

export const FEATURE_BOILERPLATE = [
  "primary assembly",
  "central function",
  "cooperating components",
  "unified structure",
  "defined sequence",
  "intended result",
] as const;

const baseFeatureSetSchema = z
  .array(z.string().trim().min(10, "Each feature must contain at least 10 characters.").max(500, "Each feature must contain no more than 500 characters."))
  .min(1, "Add at least one feature.")
  .max(10, "Use no more than 10 features.")
  .superRefine((features, context) => {
    const seen = new Set<string>();
    features.forEach((feature, index) => {
      const normalized = feature.toLocaleLowerCase("en").replace(/\s+/g, " ");
      if (seen.has(normalized)) {
        context.addIssue({ code: "custom", message: "Duplicate features are not allowed.", path: [index] });
      }
      seen.add(normalized);
    });
  });

export function validateFeatureSet(features: unknown, sourceText: string) {
  const result = baseFeatureSetSchema.safeParse(features);
  if (!result.success) return result;

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
