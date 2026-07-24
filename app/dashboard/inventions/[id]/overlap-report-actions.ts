"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MockOverlapProvider } from "@/lib/patents/mock-overlap-provider";
import type { OverlapPatent, OverlapSummary } from "@/lib/patents/overlap-types";
import { createClient } from "@/lib/supabase/server";

export type OverlapReportActionState = { error?: string; message?: string };

const inventionIdSchema = z.string().uuid();
const failedSummary: OverlapSummary = {
  classification: "INSUFFICIENT_INFORMATION",
  fullMatches: 0,
  partialMatches: 0,
  notFound: 0,
  uncertain: 0,
};

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function patents(value: unknown): OverlapPatent[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    if (typeof source.title !== "string" || typeof source.publicationNumber !== "string") return [];
    return [{
      title: source.title,
      publicationNumber: source.publicationNumber,
      abstract: typeof source.abstract === "string" ? source.abstract : null,
    }];
  });
}

export async function generateOverlapReport(
  _: OverlapReportActionState,
  formData: FormData,
): Promise<OverlapReportActionState> {
  const parsedId = inventionIdSchema.safeParse(formData.get("invention_id"));
  if (!parsedId.success) return { error: "Invention not found." };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (authError || !userId) redirect("/login");

  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,ai_status,approved_features,feature_set_version")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (inventionError || !invention) return { error: "Invention not found." };

  const approvedFeatures = strings(invention.approved_features);
  if (invention.ai_status !== "APPROVED" || !approvedFeatures.length) {
    return { error: "Approve the extracted features before generating a report." };
  }

  const { data: patentSearch, error: searchError } = await supabase
    .from("patent_searches")
    .select("id,results")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (searchError || !patentSearch) {
    return { error: "Complete a patent search before generating a report." };
  }

  const { data: activeReport, error: activeReportError } = await supabase
    .from("overlap_reports")
    .select("id")
    .eq("invention_id", invention.id)
    .eq("patent_search_id", patentSearch.id)
    .eq("user_id", userId)
    .eq("feature_set_version", invention.feature_set_version)
    .eq("status", "PROCESSING")
    .limit(1)
    .maybeSingle();
  if (activeReportError) return { error: "The overlap report status could not be checked. Please try again." };
  if (activeReport) return { error: "An overlap report is already being generated for this patent search." };

  const { data: reportRecord, error: createError } = await supabase
    .from("overlap_reports")
    .insert({
      invention_id: invention.id,
      user_id: userId,
      patent_search_id: patentSearch.id,
      feature_set_version: invention.feature_set_version,
      status: "PROCESSING",
      summary: failedSummary,
      feature_matches: [],
      error_message: null,
    })
    .select("id")
    .single();

  if (createError || !reportRecord) {
    console.error("[mock-overlap-report] Could not create report record", createError?.code);
    return { error: createError?.code === "23505" ? "An overlap report is already being generated for this patent search." : "The overlap report could not be started. Please try again." };
  }

  try {
    const provider = new MockOverlapProvider();
    const report = await provider.generate(approvedFeatures, patents(patentSearch.results));
    const { error: saveError } = await supabase
      .from("overlap_reports")
      .update({
        status: "COMPLETED",
        summary: report.summary,
        feature_matches: report.featureMatches,
        error_message: null,
      })
      .eq("id", reportRecord.id)
      .eq("patent_search_id", patentSearch.id)
      .eq("invention_id", invention.id)
      .eq("user_id", userId);

    if (saveError) throw new Error("save_failed");

    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { message: "Preliminary overlap report generated." };
  } catch {
    const safeError = "The mock overlap report could not be generated or saved.";
    console.error("[mock-overlap-report] Report generation failed");
    const { error: saveError } = await supabase
      .from("overlap_reports")
      .update({ status: "FAILED", summary: failedSummary, feature_matches: [], error_message: safeError })
      .eq("id", reportRecord.id)
      .eq("patent_search_id", patentSearch.id)
      .eq("invention_id", invention.id)
      .eq("user_id", userId);

    if (saveError) console.error("[mock-overlap-report] Could not save failed status", saveError.code);
    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { error: safeError };
  }
}
