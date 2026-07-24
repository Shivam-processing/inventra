"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  resolveClarificationState,
  type ClarificationItem,
  type ClarificationInput,
} from "@/lib/ai/clarification";
import { createClient } from "@/lib/supabase/server";

export type ClarificationActionState = { error?: string; message?: string };

const actionSchema = z.object({
  inventionId: z.string().uuid(),
  revision: z.coerce.number().int().nonnegative(),
  intent: z.enum(["save", "complete"]),
});
const answerSchema = z.string().trim().max(3000, "Each clarification answer must contain no more than 3,000 characters.");

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function clarificationInput(invention: {
  title: string;
  problem_statement: string;
  ai_analysis: unknown;
  approved_features: unknown;
}): ClarificationInput {
  const analysis = record(invention.ai_analysis);
  return {
    title: invention.title,
    problemStatement: invention.problem_statement,
    proposedSolution: text(analysis.proposedSolution),
    noveltyDescription: text(analysis.noveltyDescription),
    claimsDraft: text(analysis.claimsDraft) || text(analysis.preliminaryClaims),
    approvedFeatures: strings(invention.approved_features),
  };
}

export async function saveClarifications(
  _: ClarificationActionState,
  formData: FormData,
): Promise<ClarificationActionState> {
  const input = actionSchema.safeParse({
    inventionId: formData.get("invention_id"),
    revision: formData.get("revision"),
    intent: formData.get("intent"),
  });
  if (!input.success) return { error: "The clarification request is invalid. Reload and try again." };

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login");

  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,ai_status,ai_analysis,approved_features,feature_set_version,clarification_questions")
    .eq("id", input.data.inventionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (inventionError || !invention) return { error: "Invention not found." };
  if (invention.ai_status !== "NEEDS_REVIEW" && invention.ai_status !== "APPROVED") {
    return { error: "Analyse the invention before answering clarification questions." };
  }

  const current = resolveClarificationState(clarificationInput(invention), invention.clarification_questions);
  if (current.revision !== input.data.revision) {
    return { error: "The clarification answers changed elsewhere. Reload and try again." };
  }

  const nextItems: ClarificationItem[] = [];
  for (const item of current.items) {
    const answer = answerSchema.safeParse(formData.get(`answer:${item.id}`));
    if (!answer.success) return { error: answer.error.issues[0]?.message ?? "Review the clarification answers." };
    const skipped = formData.get(`skip:${item.id}`) === "true";
    nextItems.push({ ...item, answer: skipped ? "" : answer.data, skipped });
  }

  if (input.data.intent === "complete") {
    const unanswered = nextItems.find((item) => !item.skipped && item.answer.length === 0);
    if (unanswered) return { error: "Answer or skip every optional clarification before marking the step complete." };
  }

  const technicalChanged = current.items.some((item, index) => {
    const next = nextItems[index];
    return item.answer !== next.answer || (item.answer.length > 0 && next.skipped);
  });
  const status = input.data.intent === "complete"
    ? "COMPLETED"
    : nextItems.some((item) => item.answer.length > 0 || item.skipped)
      ? "IN_PROGRESS"
      : "NOT_STARTED";
  const stateChanged = technicalChanged
    || status !== current.status
    || current.items.some((item, index) => item.skipped !== nextItems[index].skipped);
  if (!stateChanged) return { message: "No clarification changes to save." };

  const newlyRequiresReview = technicalChanged && !current.featureReviewRequired;
  const nextFeatureVersion = newlyRequiresReview
    ? invention.feature_set_version + 1
    : invention.feature_set_version;
  const nextState = {
    schemaVersion: 1 as const,
    revision: current.revision + 1,
    status,
    featureReviewRequired: current.featureReviewRequired || technicalChanged,
    items: nextItems,
    updatedAt: new Date().toISOString(),
  };

  let update = supabase
    .from("invention_cases")
    .update({
      clarification_questions: nextState,
      ...(technicalChanged ? { ai_status: "NEEDS_REVIEW" } : {}),
      ...(newlyRequiresReview ? { feature_set_version: nextFeatureVersion } : {}),
    })
    .eq("id", invention.id)
    .eq("user_id", userId)
    .eq("feature_set_version", invention.feature_set_version);
  update = invention.clarification_questions === null
    ? update.is("clarification_questions", null)
    : update.filter("clarification_questions", "eq", JSON.stringify(invention.clarification_questions));

  const { data: saved, error: saveError } = await update.select("id").maybeSingle();
  if (saveError || !saved) return { error: "The clarification answers changed before saving completed. Reload and retry." };

  revalidatePath(`/dashboard/inventions/${invention.id}`);
  if (technicalChanged) {
    return { message: "Clarification answers saved. Review and approve the feature list again before continuing." };
  }
  return { message: status === "COMPLETED" ? "Clarification step completed." : "Clarification progress saved." };
}
