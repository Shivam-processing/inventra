"use server";

import { z } from "zod";
import { classifyInvention } from "@/lib/grants/classifier";
import { CURATED_GOVERNMENT_SCHEMES } from "@/lib/grants/curated-schemes";
import { createGrantInputHash } from "@/lib/grants/input-hash";
import { rankSchemes } from "@/lib/grants/matcher";
import { mergeCuratedAndLive } from "@/lib/grants/normalizer";
import { discoverOfficialSchemes, GrantWebSearchError } from "@/lib/grants/openai-web-provider";
import { buildGrantSearchPrompt } from "@/lib/grants/query";
import type { ApplicantProfile, GrantSearchResult, InventionGrantContext } from "@/lib/grants/types";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/get-locale";
import { createTranslator } from "@/lib/i18n/translate";

const answer = z.enum(["yes", "no", "not_sure"]);
const inputSchema = z.object({
  inventionId: z.string().uuid(),
  includeLive: z.boolean().optional().default(false),
  applicant: z.object({
    applicantType: z.enum(["individual", "student", "researcher", "dpiit_startup", "startup_without_dpiit", "micro", "small_entity", "existing_company", "incubator", "not_sure"]),
    developmentStatus: z.enum(["idea", "proof_of_concept", "prototype", "pilot", "market_ready", "revenue", "not_sure"]),
    dpiitRecognised: answer, udyamRegistered: answer, incorporated: answer, incorporatedUnderTwoYears: answer, hasPrototype: answer, hasRevenue: answer,
    state: z.string().trim().max(100),
    supportTypes: z.array(z.enum(["prototype", "research", "commercialisation", "loan", "incubation", "fellowship", "ip", "competition", "any"])).min(1).max(9),
  }),
});

export type GrantFinderActionState = { ok: true; result: GrantSearchResult } | { ok: false; error: string };

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }
function clarificationAnswers(value: unknown) {
  const source = record(value);
  const answers = Array.isArray(source.answers) ? source.answers : [];
  return answers.flatMap((item) => { const value = record(item); const answerText = text(value.answer); return answerText ? [answerText] : []; }).slice(0, 5);
}

export async function findMatchingSchemes(rawInput: unknown): Promise<GrantFinderActionState> {
  const t = createTranslator(await getLocale());
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: t("grants.error.validation") };
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (authError || !userId) return { ok: false, error: t("grants.error.auth") };
  const { data, error } = await supabase.from("invention_cases")
    .select("id,title,problem_statement,invention_description,development_stage,ai_analysis,approved_features,clarification_questions")
    .eq("id", parsed.data.inventionId).eq("user_id", userId).maybeSingle();
  if (error || !data) return { ok: false, error: t("grants.error.invention") };
  const analysis = record(data.ai_analysis);
  const context: InventionGrantContext = {
    title: text(data.title).slice(0, 300), problemStatement: text(data.problem_statement).slice(0, 3000), proposedSolution: (text(analysis.proposedSolution) || text(data.invention_description)).slice(0, 5000), noveltyDescription: text(analysis.noveltyDescription).slice(0, 3000), technicalField: text(analysis.technicalField).slice(0, 500), approvedFeatures: stringList(data.approved_features).slice(0, 10).map((item) => item.slice(0, 500)), developmentStage: text(data.development_stage).slice(0, 80), clarificationAnswers: clarificationAnswers(data.clarification_questions).map((item) => item.slice(0, 500)),
  };
  const detectedProfile = classifyInvention(context);
  const checkedAt = new Date().toISOString();
  const inputHash = createGrantInputHash(parsed.data.applicant as ApplicantProfile, context);
  const resultMetadata = { inputHash, profileMatchedAt: checkedAt };
  const curatedMatches = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detectedProfile, parsed.data.applicant as ApplicantProfile, checkedAt);
  const liveEnabled = (process.env.GRANT_SEARCH_PROVIDER ?? "curated") === "openai_web";
  const featuresNotice = context.approvedFeatures.length ? null : t("grants.notice.noFeatures");
  if (!parsed.data.includeLive) return { ok: true, result: { curated: curatedMatches, live: [], needsVerification: [], detectedProfile, liveEnabled, liveCheckedAt: null, notice: featuresNotice, ...resultMetadata } };
  if (!liveEnabled) return { ok: true, result: { curated: curatedMatches, live: [], needsVerification: [], detectedProfile, liveEnabled: false, liveCheckedAt: null, notice: featuresNotice ?? t("grants.notice.curated"), ...resultMetadata } };
  if (!process.env.OPENAI_API_KEY) return { ok: true, result: { curated: curatedMatches, live: [], needsVerification: [], detectedProfile, liveEnabled: true, liveCheckedAt: null, notice: featuresNotice ?? t("grants.notice.notConfigured"), ...resultMetadata } };
  try {
    const liveResult = await discoverOfficialSchemes(buildGrantSearchPrompt(context, parsed.data.applicant as ApplicantProfile));
    const rankedLive = rankSchemes(liveResult.schemes, detectedProfile, parsed.data.applicant as ApplicantProfile, liveResult.checkedAt);
    const merged = mergeCuratedAndLive(curatedMatches, rankedLive);
    return { ok: true, result: { curated: merged.curated, live: merged.live, needsVerification: [], detectedProfile, liveEnabled: true, liveCheckedAt: liveResult.checkedAt, notice: featuresNotice ?? (liveResult.schemes.length ? null : t("grants.notice.noOfficial")), ...resultMetadata } };
  } catch (error) {
    const notice = error instanceof GrantWebSearchError ? t("grants.notice.liveFailed") : t("grants.notice.liveUnavailable");
    return { ok: true, result: { curated: curatedMatches, live: [], needsVerification: [], detectedProfile, liveEnabled: true, liveCheckedAt: null, notice, ...resultMetadata } };
  }
}
