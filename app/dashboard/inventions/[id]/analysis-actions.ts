"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MockAIProvider } from "@/lib/ai/mock-provider";
import { OpenAIProvider, OpenAIProviderError } from "@/lib/ai/openai-provider";
import {
  clarificationAnswerText,
  parseClarificationState,
  resolveClarificationState,
} from "@/lib/ai/clarification";
import type { InventionAnalysisInput, InventionAnalysisResult } from "@/lib/ai/types";
import { validateFeatureSet } from "@/lib/patents/feature-validation";
import { createClient } from "@/lib/supabase/server";

export type AnalysisActionState = { error?: string; message?: string };

const IMAGE_BUCKET = "invention-images";
const SIGNED_URL_TTL_SECONDS = 300;
const inventionIdSchema = z.string().uuid();

type AnalysisProvider = {
  analyse(input: InventionAnalysisInput): Promise<InventionAnalysisResult>;
};

function getProvider(): { name: "mock" | "openai"; provider: AnalysisProvider } {
  const name = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (name === "mock") return { name, provider: new MockAIProvider() };
  if (name === "openai") return { name, provider: new OpenAIProvider() };
  throw new Error("Unsupported AI_PROVIDER configuration.");
}

function safeAnalysisError(error: unknown) {
  if (error instanceof OpenAIProviderError) {
    if (process.env.NODE_ENV === "development") {
      const identifier = error.details.code ?? error.details.type ?? "request_failed";
      const status = error.details.status ? ` ${error.details.status}` : "";
      return `OpenAI error${status}: ${identifier}`;
    }
    return error.message;
  }
  return "The invention analysis could not be completed or saved. Please try again.";
}

function errorCode(error: unknown) {
  if (error instanceof OpenAIProviderError) return error.details;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return { code: error.code };
  }
  return { code: "unknown_error" };
}

const listField = z.array(z.string().trim().min(2).max(500)).min(1).max(50);
const reviewSchema = z.object({
  suggestedTitle: z.string().trim().min(3).max(200),
  technicalField: z.string().trim().min(3).max(300),
  problemStatement: z.string().trim().min(10).max(5000),
  proposedSolution: z.string().trim().min(10).max(5000),
  components: listField,
  workingSteps: listField,
  advantages: listField,
  unknowns: listField,
});

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}

async function authContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

export async function analyseInvention(_: AnalysisActionState, formData: FormData): Promise<AnalysisActionState> {
  const inventionId = inventionIdSchema.safeParse(formData.get("invention_id"));
  if (!inventionId.success) return { error: "Invention not found." };

  const { supabase, userId } = await authContext();
  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description,ai_analysis,approved_features,clarification_questions")
    .eq("id", inventionId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (inventionError || !invention) return { error: "Invention not found." };

  const { data: processingClaim, error: processingError } = await supabase
    .from("invention_cases")
    .update({ ai_status: "PROCESSING" })
    .eq("id", invention.id)
    .eq("user_id", userId)
    .or("ai_status.is.null,ai_status.neq.PROCESSING")
    .select("id")
    .maybeSingle();

  if (processingError || !processingClaim) {
    if (processingError) console.error("[invention-analysis] Failed to set PROCESSING status", errorCode(processingError));
    if (!processingError) return { error: "An invention analysis request is already in progress." };
    return { error: "The invention analysis could not be started. Please try again." };
  }

  try {
    const { name: providerName, provider } = getProvider();
    let imageUrls: string[] = [];

    if (providerName === "openai") {
      const { data: imageRows, error: imageError } = await supabase
        .from("invention_images")
        .select("storage_path")
        .eq("invention_id", invention.id)
        .eq("user_id", userId)
        .limit(3);

      if (imageError) throw imageError;

      const storagePaths = (imageRows ?? []).map((image) => image.storage_path);
      if (storagePaths.length) {
        const { data: signedImages, error: signedError } = await supabase.storage
          .from(IMAGE_BUCKET)
          .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS);

        if (signedError || !signedImages) throw signedError ?? new Error("Signed image URLs were not created.");
        imageUrls = signedImages.flatMap((image) => image.signedUrl ? [image.signedUrl] : []);
        if (imageUrls.length !== storagePaths.length) throw new Error("A signed image URL was not created.");
      }
    }

    const result = await provider.analyse({
      title: invention.title,
      problemStatement: invention.problem_statement,
      description: invention.invention_description,
      imageUrls,
    });
    const previousAnalysis = invention.ai_analysis && typeof invention.ai_analysis === "object" && !Array.isArray(invention.ai_analysis)
      ? invention.ai_analysis as Record<string, unknown>
      : {};
    const clarificationState = resolveClarificationState({
      title: invention.title,
      problemStatement: invention.problem_statement,
      proposedSolution: result.analysis.proposedSolution,
      noveltyDescription: typeof previousAnalysis.noveltyDescription === "string" ? previousAnalysis.noveltyDescription : "",
      claimsDraft: typeof previousAnalysis.claimsDraft === "string"
        ? previousAnalysis.claimsDraft
        : typeof previousAnalysis.preliminaryClaims === "string" ? previousAnalysis.preliminaryClaims : "",
      approvedFeatures: Array.isArray(invention.approved_features)
        ? invention.approved_features.filter((feature): feature is string => typeof feature === "string" && feature.trim().length > 0)
        : [],
    }, invention.clarification_questions);
    const { error } = await supabase
      .from("invention_cases")
      .update({
        ai_status: "NEEDS_REVIEW",
        ai_analysis: result.analysis,
        clarification_questions: clarificationState,
      })
      .eq("id", invention.id)
      .eq("user_id", userId);

    if (error) throw error;
    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { message: "Analysis is ready for review." };
  } catch (error) {
    console.error("[invention-analysis] Provider or Supabase save failed", errorCode(error));
    const { error: failedStatusError } = await supabase.from("invention_cases").update({ ai_status: "FAILED" }).eq("id", invention.id).eq("user_id", userId);
    if (failedStatusError) console.error("[invention-analysis] Failed to set FAILED status", errorCode(failedStatusError));
    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { error: safeAnalysisError(error) };
  }
}

export async function approveAnalysis(_: AnalysisActionState, formData: FormData): Promise<AnalysisActionState> {
  const inventionId = inventionIdSchema.safeParse(formData.get("invention_id"));
  const intent = String(formData.get("intent") ?? "");
  const submittedFeatures = formData.getAll("keyFeatures").map(String);
  const result = reviewSchema.safeParse({
    suggestedTitle: formData.get("suggestedTitle"),
    technicalField: formData.get("technicalField"),
    problemStatement: formData.get("problemStatement"),
    proposedSolution: formData.get("proposedSolution"),
    components: lines(formData.get("components")),
    workingSteps: lines(formData.get("workingSteps")),
    advantages: lines(formData.get("advantages")),
    unknowns: lines(formData.get("unknowns")),
  });

  if (!inventionId.success) return { error: "Invention not found." };
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Review the analysis fields." };
  if (intent !== "save_features" && intent !== "approve_features") return { error: "Choose whether to save or approve the feature list." };

  const { supabase, userId } = await authContext();
  const { data: invention } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description,ai_status,ai_analysis,clarification_questions,approved_features,feature_set_version")
    .eq("id", inventionId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (!invention) return { error: "Invention not found." };

  const existingAnalysis = invention.ai_analysis && typeof invention.ai_analysis === "object" && !Array.isArray(invention.ai_analysis)
    ? invention.ai_analysis as Record<string, unknown>
    : {};
  const sourceText = [
    invention.title,
    invention.problem_statement,
    invention.invention_description,
    result.data.proposedSolution,
    existingAnalysis.noveltyDescription,
    existingAnalysis.claimsDraft,
    existingAnalysis.preliminaryClaims,
    clarificationAnswerText(invention.clarification_questions),
  ].filter((value): value is string => typeof value === "string").join("\n");
  const featureResult = validateFeatureSet(submittedFeatures, sourceText);
  if (!featureResult.success) return { error: featureResult.error.issues[0]?.message ?? "Review the feature list." };

  const analysisFields = result.data;
  const approvedFeatures = Array.isArray(invention.approved_features)
    ? invention.approved_features.filter((feature): feature is string => typeof feature === "string")
    : [];
  const featuresChanged = JSON.stringify(approvedFeatures) !== JSON.stringify(featureResult.data);
  const approving = intent === "approve_features";
  const nextVersion = approving && (featuresChanged || invention.feature_set_version === 0)
    ? invention.feature_set_version + 1
    : invention.feature_set_version;
  const clarificationState = parseClarificationState(invention.clarification_questions);
  let update = supabase
    .from("invention_cases")
    .update({
      ai_status: approving ? "APPROVED" : "NEEDS_REVIEW",
      ai_analysis: { ...analysisFields, keyFeatures: featureResult.data },
      ...(approving && clarificationState ? {
        clarification_questions: { ...clarificationState, featureReviewRequired: false },
      } : {}),
      ...(approving ? { approved_features: featureResult.data, feature_set_version: nextVersion } : {}),
    })
    .eq("id", invention.id)
    .eq("user_id", userId)
    .eq("feature_set_version", invention.feature_set_version);
  if (approving && clarificationState) {
    update = update.filter("clarification_questions", "eq", JSON.stringify(invention.clarification_questions));
  }
  const { data: updatedInvention, error } = await update.select("id").maybeSingle();

  if (error || !updatedInvention) return { error: approving ? "The feature set changed before approval completed. Reload and try again." : "The feature edits could not be saved." };
  revalidatePath(`/dashboard/inventions/${invention.id}`);
  return { message: approving ? `Features approved as version ${nextVersion}.` : "Feature edits saved. Approval is required before new downstream generation." };
}
