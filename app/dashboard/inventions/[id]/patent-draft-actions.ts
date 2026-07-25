"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseClarificationState } from "@/lib/ai/clarification";
import { selectLatestCompletedPatentSearch } from "@/lib/patents/feature-comparison";
import {
  MockPatentDraftProvider,
  MOCK_PATENT_DRAFT_PROVIDER,
} from "@/lib/patents/mock-patent-draft-provider";
import {
  PATENT_DRAFT_SECTION_KEYS,
  type PatentDraftInput,
  type PatentDraftSections,
} from "@/lib/patents/patent-draft-types";
import type { FeatureOverlapMatch, OverlapSummary } from "@/lib/patents/overlap-types";
import type { PatentSearchResult } from "@/lib/patents/patent-search";
import { createClient } from "@/lib/supabase/server";

export type PatentDraftActionState = { error?: string; message?: string };

const idSchema = z.string().uuid();
const sectionSchema = z.string().trim().min(1, "Every draft section is required.").max(30000);
const saveSchema = z.object({
  inventionId: idSchema,
  draftId: idSchema,
  version: z.coerce.number().int().positive(),
  sections: z.object({
    title: sectionSchema,
    technicalField: sectionSchema,
    background: sectionSchema,
    problemStatement: sectionSchema,
    summaryOfInvention: sectionSchema,
    detailedDescription: sectionSchema,
    essentialFeatures: sectionSchema,
    exampleImplementation: sectionSchema,
    preliminaryClaims: sectionSchema,
    abstract: sectionSchema,
  }),
});

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function patentResults(value: unknown): PatentSearchResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    if (typeof source.title !== "string" || typeof source.publicationNumber !== "string") return [];
    return [{
      title: source.title,
      publicationNumber: source.publicationNumber,
      priorityDate: typeof source.priorityDate === "string" ? source.priorityDate : null,
      publicationDate: typeof source.publicationDate === "string" ? source.publicationDate : null,
      applicant: typeof source.applicant === "string" ? source.applicant : null,
      abstract: typeof source.abstract === "string" ? source.abstract : null,
      sourceId: typeof source.sourceId === "string" ? source.sourceId : source.publicationNumber,
      sourceUrl: typeof source.sourceUrl === "string" ? source.sourceUrl : "",
    }];
  });
}

function overlapSummary(value: unknown): OverlapSummary {
  const source = record(value);
  const classification = source.classification;
  return {
    classification: classification === "HIGH_CONFLICT" || classification === "PARTIAL_OVERLAP" || classification === "LOW_OVERLAP" || classification === "INSUFFICIENT_INFORMATION"
      ? classification
      : "INSUFFICIENT_INFORMATION",
    fullMatches: typeof source.fullMatches === "number" ? source.fullMatches : 0,
    partialMatches: typeof source.partialMatches === "number" ? source.partialMatches : 0,
    notFound: typeof source.notFound === "number" ? source.notFound : 0,
    uncertain: typeof source.uncertain === "number" ? source.uncertain : 0,
  };
}

function overlapMatches(value: unknown): FeatureOverlapMatch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    const matchType = source.matchType;
    if (typeof source.feature !== "string" || typeof source.explanation !== "string" || (matchType !== "FULL" && matchType !== "PARTIAL" && matchType !== "NOT_FOUND" && matchType !== "UNCERTAIN")) return [];
    return [{
      feature: source.feature,
      matchedPatentTitle: typeof source.matchedPatentTitle === "string" ? source.matchedPatentTitle : null,
      publicationNumber: typeof source.publicationNumber === "string" ? source.publicationNumber : null,
      matchType,
      matchedKeywords: strings(source.matchedKeywords),
      matchedConcepts: strings(source.matchedConcepts),
      missingConcepts: strings(source.missingConcepts),
      explanation: source.explanation,
    }];
  });
}

function sections(value: unknown): PatentDraftSections | null {
  const source = record(value);
  const values = Object.fromEntries(PATENT_DRAFT_SECTION_KEYS.map((key) => [key, source[key]]));
  const result = saveSchema.shape.sections.safeParse(values);
  return result.success ? result.data : null;
}

async function authentication() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

export async function generatePatentDraft(
  _: PatentDraftActionState,
  formData: FormData,
): Promise<PatentDraftActionState> {
  const inventionId = idSchema.safeParse(formData.get("invention_id"));
  if (!inventionId.success) return { error: "Invention not found." };
  if (formData.get("acknowledgement") !== "accepted") {
    return { error: "Accept the preliminary-review acknowledgement before generating a draft." };
  }

  const { supabase, userId } = await authentication();
  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description,development_stage,publicly_disclosed,previously_sold,previously_filed,ai_status,ai_analysis,approved_features,feature_set_version,clarification_questions")
    .eq("id", inventionId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (inventionError || !invention) return { error: "Invention not found." };
  const approvedFeatures = strings(invention.approved_features);
  if (invention.ai_status !== "APPROVED" || !approvedFeatures.length) {
    return { error: "Approve the extracted features before generating a draft." };
  }

  const { data: patentSearchRows, error: searchError } = await supabase
    .from("patent_searches")
    .select("*")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false });
  const patentSearch = selectLatestCompletedPatentSearch(
    (patentSearchRows ?? []).map((search) => ({ ...search, featureSetVersion: search.feature_set_version, completedAt: typeof search.completed_at === "string" ? search.completed_at : null, createdAt: typeof search.created_at === "string" ? search.created_at : null })),
    invention.feature_set_version,
  );
  if (searchError || !patentSearch) return { error: "Complete a patent search before generating a draft." };

  const { data: overlapReport, error: reportError } = await supabase
    .from("overlap_reports")
    .select("id,summary,feature_matches")
    .eq("invention_id", invention.id)
    .eq("patent_search_id", patentSearch.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError || !overlapReport) return { error: "Complete an overlap report for the latest patent search before generating a draft." };

  const acknowledgementAt = new Date().toISOString();
  const { data: existingDraft, error: existingError } = await supabase
    .from("patent_drafts")
    .select("id,status,version")
    .eq("invention_id", invention.id)
    .eq("patent_search_id", patentSearch.id)
    .eq("overlap_report_id", overlapReport.id)
    .eq("user_id", userId)
    .eq("feature_set_version", invention.feature_set_version)
    .maybeSingle();
  if (existingError) return { error: "The existing draft could not be loaded." };
  if (existingDraft?.status === "PROCESSING") return { error: "A patent draft is already being generated." };

  let draftId: string;
  let nextVersion = 1;

  if (existingDraft) {
    const { data: claimedDraft, error: claimError } = await supabase
      .from("patent_drafts")
      .update({ status: "PROCESSING", acknowledgement_at: acknowledgementAt, error_message: null })
      .eq("id", existingDraft.id)
      .eq("user_id", userId)
      .neq("status", "PROCESSING")
      .select("id,version")
      .maybeSingle();
    if (claimError || !claimedDraft) return { error: "A patent draft generation request is already in progress." };
    draftId = claimedDraft.id;
    nextVersion = claimedDraft.version + 1;
  } else {
    const { data: createdDraft, error: createError } = await supabase
      .from("patent_drafts")
      .insert({
        invention_id: invention.id,
        patent_search_id: patentSearch.id,
        overlap_report_id: overlapReport.id,
        user_id: userId,
        feature_set_version: invention.feature_set_version,
        sections: {},
        original_sections: {},
        provider_name: MOCK_PATENT_DRAFT_PROVIDER.name,
        provider_version: MOCK_PATENT_DRAFT_PROVIDER.version,
        status: "PROCESSING",
        version: 1,
        acknowledgement_at: acknowledgementAt,
        error_message: null,
      })
      .select("id")
      .single();
    if (createError || !createdDraft) {
      const duplicate = createError?.code === "23505";
      return { error: duplicate ? "A patent draft generation request is already in progress." : "The patent draft could not be started. Apply the patent-drafts migration if it is not yet installed." };
    }
    draftId = createdDraft.id;
  }

  try {
    const analysis = record(invention.ai_analysis);
    const clarification = parseClarificationState(invention.clarification_questions);
    const input: PatentDraftInput = {
      title: typeof analysis.suggestedTitle === "string" ? analysis.suggestedTitle : invention.title,
      problemStatement: invention.problem_statement,
      description: invention.invention_description,
      noveltyDescription: typeof analysis.noveltyDescription === "string" ? analysis.noveltyDescription : "",
      clarificationAnswers: clarification?.items.filter((item) => !item.skipped && item.answer.trim()).map((item) => ({ question: item.question, answer: item.answer.trim() })) ?? [],
      developmentStage: invention.development_stage,
      publiclyDisclosed: invention.publicly_disclosed,
      previouslySold: invention.previously_sold,
      previouslyFiled: invention.previously_filed,
      technicalField: typeof analysis.technicalField === "string" ? analysis.technicalField : "",
      approvedFeatures,
      patentResults: patentResults(patentSearch.results),
      overlapSummary: overlapSummary(overlapReport.summary),
      overlapMatches: overlapMatches(overlapReport.feature_matches),
    };
    const generatedResult = saveSchema.shape.sections.safeParse(
      await new MockPatentDraftProvider().generate(input),
    );
    if (!generatedResult.success) throw new Error("invalid_generated_sections");
    const generatedSections = generatedResult.data;
    const { data: savedDraft, error: saveError } = await supabase
      .from("patent_drafts")
      .update({
        sections: generatedSections,
        original_sections: generatedSections,
        provider_name: MOCK_PATENT_DRAFT_PROVIDER.name,
        provider_version: MOCK_PATENT_DRAFT_PROVIDER.version,
        status: "COMPLETED",
        version: nextVersion,
        error_message: null,
      })
      .eq("id", draftId)
      .eq("invention_id", invention.id)
      .eq("patent_search_id", patentSearch.id)
      .eq("overlap_report_id", overlapReport.id)
      .eq("user_id", userId)
      .eq("status", "PROCESSING")
      .select("id")
      .maybeSingle();
    if (saveError || !savedDraft) throw new Error("save_failed");

    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { message: "Preliminary patent draft generated." };
  } catch {
    const safeError = "The mock patent draft could not be generated or saved.";
    console.error("[mock-patent-draft] Draft generation failed");
    const { error } = await supabase
      .from("patent_drafts")
      .update({ status: "FAILED", error_message: safeError })
      .eq("id", draftId)
      .eq("invention_id", invention.id)
      .eq("user_id", userId);
    if (error) console.error("[mock-patent-draft] Could not save failed status", error.code);
    revalidatePath(`/dashboard/inventions/${invention.id}`);
    return { error: safeError };
  }
}

export async function savePatentDraft(
  _: PatentDraftActionState,
  formData: FormData,
): Promise<PatentDraftActionState> {
  const result = saveSchema.safeParse({
    inventionId: formData.get("invention_id"),
    draftId: formData.get("draft_id"),
    version: formData.get("version"),
    sections: Object.fromEntries(PATENT_DRAFT_SECTION_KEYS.map((key) => [key, formData.get(key)])),
  });
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Review every required draft section." };

  const { supabase, userId } = await authentication();
  const { data: draft, error: draftError } = await supabase
    .from("patent_drafts")
    .select("id,invention_id,patent_search_id,overlap_report_id,status,version,feature_set_version,sections")
    .eq("id", result.data.draftId)
    .eq("invention_id", result.data.inventionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (draftError || !draft) return { error: "Patent draft not found." };
  if (draft.status !== "COMPLETED") return { error: "The patent draft is not ready for editing." };
  if (draft.version !== result.data.version) return { error: "This draft was updated elsewhere. Reload before saving." };

  const [{ data: invention }, { data: patentSearch }, { data: overlapReport }] = await Promise.all([
    supabase.from("invention_cases").select("id").eq("id", draft.invention_id).eq("user_id", userId).maybeSingle(),
    supabase.from("patent_searches").select("id,feature_set_version").eq("id", draft.patent_search_id).eq("invention_id", draft.invention_id).eq("user_id", userId).eq("status", "COMPLETED").maybeSingle(),
    supabase.from("overlap_reports").select("id,feature_set_version").eq("id", draft.overlap_report_id).eq("patent_search_id", draft.patent_search_id).eq("invention_id", draft.invention_id).eq("user_id", userId).eq("status", "COMPLETED").maybeSingle(),
  ]);
  if (!invention || !patentSearch || !overlapReport) return { error: "The draft source records are unavailable or no longer owned by this account." };
  if (patentSearch.feature_set_version !== draft.feature_set_version || overlapReport.feature_set_version !== draft.feature_set_version) {
    return { error: "The draft source records do not match its saved feature-set version." };
  }

  const currentSections = sections(draft.sections);
  if (currentSections && JSON.stringify(currentSections) === JSON.stringify(result.data.sections)) {
    return { message: "No draft changes to save." };
  }

  const { data: updatedDraft, error: updateError } = await supabase
    .from("patent_drafts")
    .update({ sections: result.data.sections, version: draft.version + 1, error_message: null })
    .eq("id", draft.id)
    .eq("invention_id", draft.invention_id)
    .eq("patent_search_id", draft.patent_search_id)
    .eq("overlap_report_id", draft.overlap_report_id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("version", draft.version)
    .select("id")
    .maybeSingle();
  if (updateError || !updatedDraft) return { error: "The draft changed before this save completed. Reload and try again." };

  revalidatePath(`/dashboard/inventions/${draft.invention_id}`);
  return { message: "Draft changes saved." };
}
