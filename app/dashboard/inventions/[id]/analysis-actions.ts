"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MockAIProvider } from "@/lib/ai/mock-provider";
import { OpenAIProvider, OpenAIProviderError } from "@/lib/ai/openai-provider";
import type { InventionAnalysisInput, InventionAnalysisResult } from "@/lib/ai/types";
import { createClient } from "@/lib/supabase/server";

export type AnalysisActionState = { error?: string; message?: string };

const IMAGE_BUCKET = "invention-images";
const SIGNED_URL_TTL_SECONDS = 300;

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

const listField = z.array(z.string().trim().min(2)).min(1);
const reviewSchema = z.object({
  suggestedTitle: z.string().trim().min(3).max(200),
  technicalField: z.string().trim().min(3).max(300),
  problemStatement: z.string().trim().min(10).max(5000),
  proposedSolution: z.string().trim().min(10).max(5000),
  components: listField,
  workingSteps: listField,
  advantages: listField,
  unknowns: listField,
  clarificationQuestions: z.array(z.string().trim().min(5)).length(3),
  keyFeatures: listField,
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
  const inventionId = String(formData.get("invention_id") ?? "");
  if (!inventionId) return { error: "Invention not found." };

  const { supabase, userId } = await authContext();
  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description")
    .eq("id", inventionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (inventionError || !invention) return { error: "Invention not found." };

  const { error: processingError } = await supabase
    .from("invention_cases")
    .update({ ai_status: "PROCESSING" })
    .eq("id", invention.id)
    .eq("user_id", userId);

  if (processingError) {
    console.error("[invention-analysis] Failed to set PROCESSING status", processingError);
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
    const { error } = await supabase
      .from("invention_cases")
      .update({
        ai_status: "NEEDS_REVIEW",
        ai_analysis: result.analysis,
        clarification_questions: result.clarificationQuestions,
        approved_features: [],
      })
      .eq("id", invention.id)
      .eq("user_id", userId);

    if (error) throw error;
    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { message: "Analysis is ready for review." };
  } catch (error) {
    console.error("[invention-analysis] Provider or Supabase save failed", error);
    const { error: failedStatusError } = await supabase.from("invention_cases").update({ ai_status: "FAILED" }).eq("id", invention.id).eq("user_id", userId);
    if (failedStatusError) console.error("[invention-analysis] Failed to set FAILED status", failedStatusError);
    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { error: safeAnalysisError(error) };
  }
}

export async function approveAnalysis(_: AnalysisActionState, formData: FormData): Promise<AnalysisActionState> {
  const inventionId = String(formData.get("invention_id") ?? "");
  const result = reviewSchema.safeParse({
    suggestedTitle: formData.get("suggestedTitle"),
    technicalField: formData.get("technicalField"),
    problemStatement: formData.get("problemStatement"),
    proposedSolution: formData.get("proposedSolution"),
    components: lines(formData.get("components")),
    workingSteps: lines(formData.get("workingSteps")),
    advantages: lines(formData.get("advantages")),
    unknowns: lines(formData.get("unknowns")),
    clarificationQuestions: lines(formData.get("clarificationQuestions")),
    keyFeatures: lines(formData.get("keyFeatures")),
  });

  if (!inventionId || !result.success) {
    return { error: result.success ? "Invention not found." : result.error.issues[0]?.message ?? "Review the analysis fields." };
  }

  const { supabase, userId } = await authContext();
  const { data: invention } = await supabase
    .from("invention_cases")
    .select("id")
    .eq("id", inventionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!invention) return { error: "Invention not found." };

  const { clarificationQuestions, keyFeatures, ...analysisFields } = result.data;
  const { error } = await supabase
    .from("invention_cases")
    .update({
      ai_status: "APPROVED",
      ai_analysis: { ...analysisFields, keyFeatures },
      clarification_questions: clarificationQuestions,
      approved_features: keyFeatures,
    })
    .eq("id", invention.id)
    .eq("user_id", userId);

  if (error) return { error: "The reviewed features could not be approved." };
  revalidatePath(`/dashboard/inventions/${invention.id}`);
  return { message: "Features approved successfully." };
}
