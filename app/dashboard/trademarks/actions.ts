"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { discoverOfficialTrademarkRecords } from "@/lib/trademarks/official-discovery-provider";
import { storedTrademarkHistory } from "@/lib/trademarks/history";
import { buildTrademarkProviderInput, trademarkInputHash } from "@/lib/trademarks/input-builder";
import { normalizeTrademarkName } from "@/lib/trademarks/normalization";
import { normalizeOfficialRecord, type DiscoveredOfficialRecord } from "@/lib/trademarks/official-source-validator";
import { generatePhoneticCandidates, phoneticSimilarity } from "@/lib/trademarks/phonetic-similarity";
import { unavailableTrademarkAIAnalysis } from "@/lib/trademarks/mock-provider";
import { trademarkAnalysisProvider } from "@/lib/trademarks/provider-factory";
import { calculateTrademarkRisk } from "@/lib/trademarks/risk-calculator";
import { trademarkAIAnalysisSchema, trademarkAnalysisRequestSchema, trademarkConflictCandidateSchema, trademarkNameSchema, trademarkResultSchema, type TrademarkHistoryItem, type TrademarkInventionContext } from "@/lib/trademarks/types";
import { generateVisualCandidates, visualSimilarity } from "@/lib/trademarks/visual-similarity";
import { createClient } from "@/lib/supabase/server";

export type TrademarkActionState = { ok: true; item: TrademarkHistoryItem; reused: boolean } | { ok: false; error: string };
type SimpleState = { ok: true; message: string } | { ok: false; error: string };
const idSchema = z.string().uuid();
const saveNameSchema = z.object({ inventionId: z.string().uuid(), brandName: trademarkNameSchema, confirmed: z.literal(true) });
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }

async function session() { const supabase = await createClient(); const { data, error } = await supabase.auth.getClaims(); return { supabase, userId: error ? null : data?.claims?.sub ?? null }; }
async function ownedContext(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, inventionId: string | null): Promise<{ context: TrademarkInventionContext | null; title: string | null } | null> {
  if (!inventionId) return { context: null, title: null };
  const { data } = await supabase.from("invention_cases").select("id,title,problem_statement,invention_description,development_stage,ai_analysis,approved_features").eq("id", inventionId).eq("user_id", userId).maybeSingle(); if (!data) return null;
  const analysis = record(data.ai_analysis); return { title: data.title, context: { title: text(data.title).slice(0, 300), problemStatement: text(data.problem_statement).slice(0, 3000), proposedSolution: (text(analysis.proposedSolution) || text(data.invention_description)).slice(0, 5000), technicalField: text(analysis.technicalField).slice(0, 500), approvedFeatures: strings(data.approved_features).slice(0, 10).map((item) => item.slice(0, 500)), developmentStage: text(data.development_stage).slice(0, 80) } };
}

export async function analyseTrademark(raw: unknown): Promise<TrademarkActionState> {
  const parsed = trademarkAnalysisRequestSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Review the proposed name, Nice class and description." };
  const { supabase, userId } = await session(); if (!userId) return { ok: false, error: "Sign in to analyse a trademark." };
  const owned = await ownedContext(supabase, userId, parsed.data.inventionId); if (!owned) return { ok: false, error: "The selected invention is unavailable." };
  const provider = trademarkAnalysisProvider(); const discoveryMode = (process.env.TRADEMARK_DISCOVERY_PROVIDER ?? "manual_official").toLowerCase(); const input = buildTrademarkProviderInput(parsed.data, owned.context); const inputHash = trademarkInputHash(input, `${provider.name}:${provider.version}`, discoveryMode);
  const { data: cached } = await supabase.from("trademark_searches").select("*").eq("user_id", userId).eq("input_hash", inputHash).eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (cached) { const item = storedTrademarkHistory(cached, owned.title, provider.version); if (item?.result) return { ok: true, item, reused: true }; }
  const normalized = normalizeTrademarkName(parsed.data.brandName);
  const { data: processing, error: insertError } = await supabase.from("trademark_searches").insert({ user_id: userId, invention_id: parsed.data.inventionId, brand_name: normalized.originalName, normalized_brand_name: normalized.normalizedName, nice_class: parsed.data.niceClass, goods_services_description: parsed.data.goodsServicesDescription || null, intended_market: parsed.data.intendedMarket, status: "PROCESSING", provider: provider.name, provider_version: provider.version, input_hash: inputHash }).select("id").maybeSingle();
  if (insertError || !processing) { const { data: existing } = await supabase.from("trademark_searches").select("id").eq("user_id", userId).eq("input_hash", inputHash).eq("status", "PROCESSING").maybeSingle(); return { ok: false, error: existing ? "This trademark analysis is already in progress." : "The trademark search could not be saved. Apply the trademark migration and retry." }; }
  try {
    const visualCandidates = generateVisualCandidates(input.brandName); const phoneticCandidates = generatePhoneticCandidates(input.brandName); let aiAnalysis; try { aiAnalysis = trademarkAIAnalysisSchema.parse(await provider.analyseTrademark(input)); } catch (providerError) { if (provider.name !== "openai") throw providerError; aiAnalysis = unavailableTrademarkAIAnalysis(input); }
    const discoveryEnabled = discoveryMode === "openai_web" && Boolean(process.env.OPENAI_API_KEY); let discoveryPerformed = false; let records: DiscoveredOfficialRecord[] = []; if (discoveryEnabled) { try { records = await discoverOfficialTrademarkRecords(input); discoveryPerformed = true; } catch { records = []; } }
    const candidates = records.map((rawRecord) => { const candidate = normalizeOfficialRecord(rawRecord, input.brandName); const visualScore = visualSimilarity(input.brandName, rawRecord.markName); const phoneticScore = phoneticSimilarity(input.brandName, rawRecord.markName); return trademarkConflictCandidateSchema.parse({ ...candidate, visualScore, phoneticScore, combinedSimilarityScore: Math.max(visualScore, phoneticScore), similarityTypes: candidate.similarityTypes.includes("IDENTICAL") ? candidate.similarityTypes : [...new Set([...candidate.similarityTypes, visualScore >= 60 ? "VISUAL" as const : null, phoneticScore >= 60 ? "PHONETIC" as const : null].filter((item): item is "IDENTICAL" | "VISUAL" | "PHONETIC" => Boolean(item)))] }); });
    const conflicts = candidates.filter((item) => item.verificationStatus === "VERIFIED_OFFICIAL"); const needsVerification = candidates.filter((item) => item.verificationStatus !== "VERIFIED_OFFICIAL");
    const risk = calculateTrademarkRisk({ niceClass: input.niceClass, visualCandidates, phoneticCandidates, conflicts, discoveryPerformed }); const officialVerificationStatus = conflicts.length ? "VERIFIED_OFFICIAL_EVIDENCE" as const : discoveryPerformed ? "SUPPLEMENTARY_OFFICIAL_SOURCES" as const : "NOT_PERFORMED" as const; const analysedAt = new Date().toISOString();
    const result = trademarkResultSchema.parse({ input: { originalName: normalized.originalName, normalizedName: normalized.normalizedName, compactName: normalized.compactName, tokens: normalized.tokens, niceClass: input.niceClass, goodsServicesDescription: input.goodsServicesDescription, intendedMarket: input.intendedMarket }, visualCandidates, phoneticCandidates, aiAnalysis, conflicts, needsVerification, risk, officialVerificationStatus, analysedAt, provider: provider.name, providerVersion: provider.version, discoveryProvider: discoveryMode });
    const { data: completed, error } = await supabase.from("trademark_searches").update({ status: "COMPLETED", analysis_result: result, overall_status: risk.overallStatus, official_verification_status: officialVerificationStatus, completed_at: analysedAt, error_code: null }).eq("id", processing.id).eq("user_id", userId).eq("status", "PROCESSING").select("*").maybeSingle();
    if (error || !completed) return { ok: false, error: "The trademark analysis could not be saved." }; const item = storedTrademarkHistory(completed, owned.title, provider.version); if (!item) return { ok: false, error: "The saved trademark analysis is invalid." }; revalidatePath("/dashboard/trademarks"); return { ok: true, item, reused: false };
  } catch (error) { const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code.slice(0, 100) : "analysis_failed"; await supabase.from("trademark_searches").update({ status: "FAILED", error_code: code }).eq("id", processing.id).eq("user_id", userId); return { ok: false, error: code === "missing_api_key" ? "Trademark AI analysis is not configured." : "Trademark analysis could not be completed. Deterministic checks remain available when you retry in mock mode." }; }
}

export async function saveProposedBrandName(raw: unknown): Promise<SimpleState> { const parsed = saveNameSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "Confirm a valid proposed brand name." }; const { supabase, userId } = await session(); if (!userId) return { ok: false, error: "Sign in to save a proposed name." }; const { data, error } = await supabase.from("invention_cases").update({ proposed_brand_name: parsed.data.brandName.trim() }).eq("id", parsed.data.inventionId).eq("user_id", userId).select("id").maybeSingle(); if (error || !data) return { ok: false, error: "The selected invention is unavailable." }; revalidatePath(`/dashboard/inventions/${parsed.data.inventionId}`); return { ok: true, message: "Saved as the proposed brand name. Trademark availability has not been confirmed." }; }
export async function deleteTrademarkHistory(raw: unknown): Promise<SimpleState> { const parsed = idSchema.safeParse(raw); if (!parsed.success) return { ok: false, error: "The history entry is unavailable." }; const { supabase, userId } = await session(); if (!userId) return { ok: false, error: "Sign in to delete search history." }; const { data, error } = await supabase.from("trademark_searches").delete().eq("id", parsed.data).eq("user_id", userId).select("id").maybeSingle(); if (error || !data) return { ok: false, error: "The history entry is unavailable." }; revalidatePath("/dashboard/trademarks"); return { ok: true, message: "Trademark search history entry deleted." }; }
