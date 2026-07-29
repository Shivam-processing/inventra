"use server";

import { revalidatePath } from "next/cache";
import { buildManufacturingInput, manufacturingInputHash } from "@/lib/manufacturing/input-builder";
import { normalizeManufacturingAnalysisForProfile } from "@/lib/manufacturing/analysis-consistency";
import { manufacturingAnalysisProvider } from "@/lib/manufacturing/provider-factory";
import { searchCurrentSuppliers, SupplierSearchError } from "@/lib/manufacturing/supplier-search-provider";
import { storedManufacturingAnalysis } from "@/lib/manufacturing/storage";
import { manufacturingAnalysisSchema, type StoredManufacturingAnalysis, type SupplierSearchSnapshot } from "@/lib/manufacturing/types";
import { manufacturingGenerationInputSchema, manufacturingSupplierSearchInputSchema, safeManufacturingError } from "@/lib/manufacturing/validation";
import { createClient } from "@/lib/supabase/server";

export type ManufacturingActionState = { ok: true; analysis: StoredManufacturingAnalysis; reused: boolean } | { ok: false; error: string };
export type SupplierActionState = { ok: true; snapshot: SupplierSearchSnapshot } | { ok: false; error: string };

async function authenticatedUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return { supabase, userId: error ? null : data?.claims?.sub ?? null };
}

export async function generateManufacturingPlan(rawInput: unknown): Promise<ManufacturingActionState> {
  const parsed = manufacturingGenerationInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: safeManufacturingError("validation") };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { ok: false, error: safeManufacturingError("auth") };
  const { data: invention, error: inventionError } = await supabase.from("invention_cases")
    .select("id,title,problem_statement,invention_description,development_stage,ai_status,ai_analysis,approved_features,clarification_questions,feature_set_version")
    .eq("id", parsed.data.inventionId).eq("user_id", userId).maybeSingle();
  if (inventionError || !invention) return { ok: false, error: safeManufacturingError("invention") };
  const approvedFeatures = Array.isArray(invention.approved_features) ? invention.approved_features.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  if (invention.ai_status !== "APPROVED" || !approvedFeatures.length) return { ok: false, error: "Approve the current technical feature set before creating a manufacturing plan." };
  const provider = manufacturingAnalysisProvider();
  const input = buildManufacturingInput(invention, parsed.data.profile);
  const inputHash = manufacturingInputHash(input, provider.version);

  const { data: cached } = await supabase.from("manufacturing_analyses").select("*")
    .eq("user_id", userId).eq("invention_id", invention.id).eq("feature_set_version", invention.feature_set_version).eq("input_hash", inputHash).eq("status", "COMPLETED")
    .order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (cached) {
    const stored = storedManufacturingAnalysis(cached, invention.feature_set_version);
    if (stored?.analysisResult) return { ok: true, analysis: stored, reused: true };
  }

  const { data: processing, error: insertError } = await supabase.from("manufacturing_analyses").insert({
    invention_id: invention.id, user_id: userId, feature_set_version: invention.feature_set_version, input_hash: inputHash,
    status: "PROCESSING", provider: provider.name, provider_version: provider.version, input_snapshot: input,
  }).select("id").maybeSingle();
  if (insertError || !processing) {
    const { data: existing } = await supabase.from("manufacturing_analyses").select("id").eq("user_id", userId).eq("invention_id", invention.id).eq("input_hash", inputHash).eq("status", "PROCESSING").maybeSingle();
    return { ok: false, error: existing ? "This manufacturing plan is already being prepared. Wait briefly and retry." : safeManufacturingError("database") };
  }

  try {
    const result = manufacturingAnalysisSchema.parse(normalizeManufacturingAnalysisForProfile(await provider.analyzeManufacturing(input), input.profile));
    const completedAt = new Date().toISOString();
    const { data: completed, error: updateError } = await supabase.from("manufacturing_analyses").update({ status: "COMPLETED", analysis_result: result, completed_at: completedAt, error_code: null })
      .eq("id", processing.id).eq("user_id", userId).eq("invention_id", invention.id).eq("status", "PROCESSING").select("*").maybeSingle();
    if (updateError || !completed) return { ok: false, error: safeManufacturingError("database") };
    const stored = storedManufacturingAnalysis(completed, invention.feature_set_version);
    if (!stored) return { ok: false, error: safeManufacturingError("database") };
    revalidatePath("/dashboard/manufacturing");
    return { ok: true, analysis: stored, reused: false };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code.slice(0, 100) : "provider_error";
    await supabase.from("manufacturing_analyses").update({ status: "FAILED", error_code: code, analysis_result: null }).eq("id", processing.id).eq("user_id", userId);
    return { ok: false, error: code === "missing_api_key" ? safeManufacturingError("configuration") : safeManufacturingError("provider") };
  }
}

export async function searchManufacturingSuppliers(rawInput: unknown): Promise<SupplierActionState> {
  const parsed = manufacturingSupplierSearchInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: safeManufacturingError("validation") };
  const { supabase, userId } = await authenticatedUserId();
  if (!userId) return { ok: false, error: safeManufacturingError("auth") };
  const { data: invention } = await supabase.from("invention_cases").select("id,feature_set_version").eq("id", parsed.data.inventionId).eq("user_id", userId).maybeSingle();
  if (!invention) return { ok: false, error: safeManufacturingError("invention") };
  const { data: row } = await supabase.from("manufacturing_analyses").select("*").eq("id", parsed.data.analysisId).eq("invention_id", invention.id).eq("user_id", userId).eq("status", "COMPLETED").maybeSingle();
  const stored = row ? storedManufacturingAnalysis(row, invention.feature_set_version) : null;
  if (!stored?.analysisResult || stored.isOutdated) return { ok: false, error: "Generate a current manufacturing plan before searching supplier listings." };
  try {
    const snapshot = await searchCurrentSuppliers(stored.analysisResult, stored.inputSnapshot.profile, parsed.data.componentIds);
    const { error } = await supabase.from("manufacturing_analyses").update({ supplier_search_result: snapshot, supplier_checked_at: snapshot.checkedAt }).eq("id", stored.id).eq("invention_id", invention.id).eq("user_id", userId);
    if (error) return { ok: false, error: safeManufacturingError("database") };
    revalidatePath("/dashboard/manufacturing");
    return { ok: true, snapshot };
  } catch (error) {
    return { ok: false, error: error instanceof SupplierSearchError ? error.message : "Current supplier listings could not be searched. Curated links remain available." };
  }
}
