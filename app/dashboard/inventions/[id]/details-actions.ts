"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseClarificationState } from "@/lib/ai/clarification";
import { claimsDraftSchema, noveltyDescriptionSchema } from "@/lib/inventions/details-validation";
import { createClient } from "@/lib/supabase/server";
import { isSupportedVoiceLanguage } from "@/lib/voice/languages";

const booleanField = z.enum(["true", "false"]).transform((value) => value === "true");
const updateDetailsSchema = z.object({
  inventionId: z.string().uuid(),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(160),
  problemStatement: z.string().trim().min(20, "Describe the problem in at least 20 characters.").max(5_000),
  inventionDescription: z.string().trim().min(40, "Describe the invention in at least 40 characters.").max(15_000),
  noveltyDescription: noveltyDescriptionSchema,
  claimsDraft: claimsDraftSchema,
  developmentStage: z.enum(["concept", "prototype", "testing", "production"]),
  publiclyDisclosed: booleanField,
  previouslySold: booleanField,
  previouslyFiled: booleanField,
  preferredLanguage: z.string().refine(isSupportedVoiceLanguage, "Choose a supported voice language."),
});

export type InventionDetailsActionState = { error?: string; message?: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateInventionDetails(
  _: InventionDetailsActionState,
  formData: FormData,
): Promise<InventionDetailsActionState> {
  const parsed = updateDetailsSchema.safeParse({
    inventionId: formData.get("invention_id"),
    title: formData.get("title"),
    problemStatement: formData.get("problem_statement"),
    inventionDescription: formData.get("invention_description"),
    noveltyDescription: formData.get("novelty_description"),
    claimsDraft: formData.get("claims_draft"),
    developmentStage: formData.get("development_stage"),
    publiclyDisclosed: formData.get("publicly_disclosed"),
    previouslySold: formData.get("previously_sold"),
    previouslyFiled: formData.get("previously_filed"),
    preferredLanguage: formData.get("preferred_language"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the invention details." };

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login");

  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description,development_stage,publicly_disclosed,previously_sold,previously_filed,preferred_language,ai_status,ai_analysis,clarification_questions")
    .eq("id", parsed.data.inventionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (inventionError || !invention) return { error: "Invention not found." };

  const analysis = record(invention.ai_analysis);
  const currentProposedSolution = text(analysis.proposedSolution) || text(invention.invention_description);
  const currentNovelty = text(analysis.noveltyDescription);
  const currentClaims = text(analysis.claimsDraft) || text(analysis.preliminaryClaims);
  const technicalChanged = parsed.data.problemStatement !== text(invention.problem_statement)
    || parsed.data.inventionDescription !== currentProposedSolution
    || parsed.data.noveltyDescription !== currentNovelty
    || parsed.data.claimsDraft !== currentClaims;

  const clarification = parseClarificationState(invention.clarification_questions);
  const nextClarification = technicalChanged && clarification
    ? { ...clarification, featureReviewRequired: true }
    : invention.clarification_questions;
  const nextAnalysis = {
    ...analysis,
    proposedSolution: parsed.data.inventionDescription,
    noveltyDescription: parsed.data.noveltyDescription,
    claimsDraft: parsed.data.claimsDraft,
    featureReviewRequired: technicalChanged ? true : analysis.featureReviewRequired,
  };
  const nextStatus = technicalChanged && invention.ai_status === "APPROVED"
    ? "NEEDS_REVIEW"
    : invention.ai_status;

  const { data: updated, error: updateError } = await supabase
    .from("invention_cases")
    .update({
      title: parsed.data.title,
      problem_statement: parsed.data.problemStatement,
      invention_description: parsed.data.inventionDescription,
      development_stage: parsed.data.developmentStage,
      publicly_disclosed: parsed.data.publiclyDisclosed,
      previously_sold: parsed.data.previouslySold,
      previously_filed: parsed.data.previouslyFiled,
      preferred_language: parsed.data.preferredLanguage,
      ai_analysis: nextAnalysis,
      ai_status: nextStatus,
      clarification_questions: nextClarification,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invention.id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) return { error: "The invention details could not be saved. Please try again." };
  revalidatePath(`/dashboard/inventions/${invention.id}`);
  revalidatePath("/dashboard");
  return { message: technicalChanged
    ? "Changes saved. Review and approve the feature list before generating new downstream records."
    : "Invention details saved." };
}
