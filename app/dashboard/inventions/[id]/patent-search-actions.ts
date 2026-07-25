"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatEpoOpsError } from "@/lib/patents/epo-client";
import {
  searchEpoPatents,
} from "@/lib/patents/patent-search";
import { buildPatentSearchPlan, patentSearchTerms } from "@/lib/patents/patent-search-relevance";
import { createClient } from "@/lib/supabase/server";

export type PatentSearchActionState = { error?: string; message?: string };

const inventionIdSchema = z.string().uuid();

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function technicalField(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const field = (value as Record<string, unknown>).technicalField;
  return typeof field === "string" ? field : "";
}

function analysisText(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : "";
}

export async function searchSimilarPatents(
  _: PatentSearchActionState,
  formData: FormData,
): Promise<PatentSearchActionState> {
  const parsedId = inventionIdSchema.safeParse(formData.get("invention_id"));
  if (!parsedId.success) return { error: "Invention not found." };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (authError || !userId) redirect("/login");

  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description,ai_status,ai_analysis,approved_features,feature_set_version")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (inventionError || !invention) return { error: "Invention not found." };

  const approvedFeatures = stringList(invention.approved_features);
  if (invention.ai_status !== "APPROVED" || approvedFeatures.length === 0) {
    return { error: "Approve the extracted features before searching patents." };
  }

  const searchPlan = buildPatentSearchPlan({
    title: invention.title,
    problemStatement: invention.problem_statement,
    proposedSolution: analysisText(invention.ai_analysis, "proposedSolution") || invention.invention_description,
    technicalField: technicalField(invention.ai_analysis),
    approvedFeatures,
  });

  if (!searchPlan.strictQuery) {
    return { error: "The invention needs a specific domain and at least one approved technical mechanism before searching." };
  }

  const initialSearchTerms = patentSearchTerms(searchPlan, "strict");

  const { data: activeSearch, error: activeSearchError } = await supabase
    .from("patent_searches")
    .select("id")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .eq("feature_set_version", invention.feature_set_version)
    .eq("status", "PROCESSING")
    .limit(1)
    .maybeSingle();
  if (activeSearchError) return { error: "The patent search status could not be checked. Please try again." };
  if (activeSearch) return { error: "A patent search is already in progress for this feature set." };

  const { data: searchRecord, error: createError } = await supabase
    .from("patent_searches")
    .insert({
      invention_id: invention.id,
      user_id: userId,
      search_terms: initialSearchTerms,
      feature_set_version: invention.feature_set_version,
      status: "PROCESSING",
      results: [],
      error_message: null,
    })
    .select("id")
    .single();

  if (createError || !searchRecord) {
    console.error("[epo-patent-search] Could not create search record", createError?.code);
    return { error: createError?.code === "23505" ? "A patent search is already in progress for this feature set." : "The patent search could not be started. Please try again." };
  }

  try {
    const execution = await searchEpoPatents(searchPlan);
    const { error: saveError } = await supabase
      .from("patent_searches")
      .update({ status: "COMPLETED", results: execution.results, search_terms: execution.searchTerms, error_message: null })
      .eq("id", searchRecord.id)
      .eq("invention_id", invention.id)
      .eq("user_id", userId);

    if (saveError) {
      console.error("[epo-patent-search] Could not save search results", saveError.code);
      return { error: "Patent results were found but could not be saved." };
    }

    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return {
      message: execution.results.length
        ? `${execution.results.length} relevant patent${execution.results.length === 1 ? "" : "s"} found.`
        : "No sufficiently relevant prior-art results were found using the current search terms. Refine the approved features and try again.",
    };
  } catch (error) {
    const safeError = formatEpoOpsError(error);
    console.error("[epo-patent-search] Search failed", safeError);
    const { error: saveError } = await supabase
      .from("patent_searches")
      .update({ status: "FAILED", results: [], error_message: safeError })
      .eq("id", searchRecord.id)
      .eq("invention_id", invention.id)
      .eq("user_id", userId);

    if (saveError) {
      console.error("[epo-patent-search] Could not save failed status", saveError.code);
    }

    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { error: safeError };
  }
}
