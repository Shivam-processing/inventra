import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DeleteInventionDialog } from "@/components/delete-invention-dialog";
import { ClarificationReview } from "@/components/clarification-review";
import { CreationImageHandoff } from "@/components/creation-image-handoff";
import { InventionAnalysis } from "@/components/invention-analysis";
import { InventionImages, type InventionImage } from "@/components/invention-images";
import { InventionDetailsEditor } from "@/components/invention-details-editor";
import { InventionTimelineLoading } from "@/components/invention-timeline";
import { InventionTimelineServer } from "@/components/invention-timeline-server";
import { InventionWorkspace } from "@/components/invention-workspace";
import { OverlapReportPanel, type OverlapReportRecord } from "@/components/overlap-report";
import { PatentDraftPanel, type PatentDraftRecord } from "@/components/patent-draft";
import { PatentSearch, type PatentSearchRecord } from "@/components/patent-search";
import { Badge } from "@/components/ui";
import { WorkflowProgress } from "@/components/workflow-progress";
import type { AIStatus } from "@/lib/ai/types";
import { resolveClarificationState } from "@/lib/ai/clarification";
import { PATENT_DRAFT_SECTION_KEYS } from "@/lib/patents/patent-draft-types";
import type { PatentSearchResult } from "@/lib/patents/patent-search";
import { selectLatestCompletedPatentSearch } from "@/lib/patents/feature-comparison";
import { calculateWorkflowState, type WorkflowStateInput } from "@/lib/patents/workflow-state";
import { buildWorkspaceSectionStates, recommendedWorkspaceSection } from "@/lib/patents/invention-workspace";
import { createClient } from "@/lib/supabase/server";
import { normalizePreferredLanguage } from "@/lib/voice/languages";
import { z } from "zod";

const BUCKET = "invention-images";

type Invention = {
  id: string;
  title: string;
  problem_statement: string;
  invention_description: string;
  development_stage: string;
  publicly_disclosed: boolean;
  previously_sold: boolean;
  previously_filed: boolean;
  preferred_language: string | null;
  ai_status: AIStatus | null;
  ai_analysis: unknown;
  clarification_questions: unknown;
  approved_features: unknown;
  feature_set_version: number;
};

type ImageRow = Omit<InventionImage, "signedUrl"> & {
  storage_path: string;
};

type PatentSearchRow = {
  id: string;
  status: string;
  feature_set_version: number;
  search_terms: unknown;
  results: unknown;
  error_message: string | null;
  completed_at?: string | null;
  created_at: string | null;
};

type OverlapReportRow = {
  id: string;
  patent_search_id: string;
  status: string;
  feature_set_version: number;
  summary: unknown;
  feature_matches: unknown;
  error_message: string | null;
};

type PatentDraftRow = {
  id: string;
  patent_search_id: string;
  overlap_report_id: string;
  status: string;
  feature_set_version: number;
  sections: unknown;
  original_sections: unknown;
  provider_name: string;
  provider_version: string;
  version: number;
  updated_at: string;
  error_message: string | null;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function hasCompleteDraftSections(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sections = value as Record<string, unknown>;
  return PATENT_DRAFT_SECTION_KEYS.every((key) => typeof sections[key] === "string" && sections[key].trim().length > 0);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function patentSearchRecord(row: PatentSearchRow): PatentSearchRecord {
  return {
    id: row.id,
    status: row.status,
    featureSetVersion: row.feature_set_version,
    searchTerms: Array.isArray(row.search_terms) ? row.search_terms.filter((term): term is string => typeof term === "string") : [],
    results: Array.isArray(row.results) ? row.results as PatentSearchResult[] : [],
    errorMessage: row.error_message,
    completedAt: row.completed_at ?? row.created_at,
  };
}

export const metadata: Metadata = { title: "Invention details" };

export default async function InventionDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [routeParams, query] = await Promise.all([params, searchParams]);
  const parsedId = z.string().uuid().safeParse(routeParams.id);
  if (!parsedId.success) notFound();
  const id = parsedId.data;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: inventionData, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,problem_statement,invention_description,development_stage,publicly_disclosed,previously_sold,previously_filed,preferred_language,ai_status,ai_analysis,clarification_questions,approved_features,feature_set_version")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (inventionError || !inventionData) notFound();
  const invention = inventionData as Invention;

  const { data: imageData, error: imageError } = await supabase
    .from("invention_images")
    .select("id,storage_path,original_name,image_type,file_size")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .order("id", { ascending: false });

  const rows = (imageData ?? []) as ImageRow[];
  let images: InventionImage[] = [];
  let imagesError = imageError ? "Images could not be loaded." : undefined;

  if (!imageError && rows.length) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(rows.map((image) => image.storage_path), 3600);

    if (!signedError && signedData) {
      const urls = new Map(signedData.filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl]));
      images = rows.flatMap(({ storage_path, ...image }) => {
        const signedUrl = urls.get(storage_path);
        return signedUrl ? [{ ...image, signedUrl }] : [];
      });
      if (images.length !== rows.length) imagesError = "Some images could not be loaded.";
    } else {
      imagesError = "Signed image links could not be created.";
    }
  }

  const status = invention.ai_status ?? "NOT_STARTED";
  const approvedFeatures = Array.isArray(invention.approved_features)
    ? invention.approved_features.filter((feature): feature is string => typeof feature === "string")
    : [];
  const analysis = record(invention.ai_analysis);
  const clarification = resolveClarificationState({
    title: invention.title,
    problemStatement: invention.problem_statement,
    proposedSolution: text(analysis.proposedSolution),
    noveltyDescription: text(analysis.noveltyDescription),
    claimsDraft: text(analysis.claimsDraft) || text(analysis.preliminaryClaims),
    approvedFeatures,
  }, invention.clarification_questions);
  const featuresApproved = status === "APPROVED" && approvedFeatures.length > 0;
  const { data: patentSearchData, error: patentSearchError } = await supabase
    .from("patent_searches")
    .select("*")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const searchRow = patentSearchData as PatentSearchRow | null;
  const patentSearch = searchRow ? patentSearchRecord(searchRow) : null;
  const { data: completedSearchData, error: completedSearchError } = featuresApproved
    ? await supabase
      .from("patent_searches")
      .select("*")
      .eq("invention_id", invention.id)
      .eq("user_id", userId)
      .eq("status", "COMPLETED")
      .eq("feature_set_version", invention.feature_set_version)
      .order("created_at", { ascending: false })
    : { data: null, error: null };
  const completedSearchRows = (completedSearchData ?? []) as PatentSearchRow[];
  const completedSearch = selectLatestCompletedPatentSearch(
    completedSearchRows.map((row) => ({
      ...row,
      featureSetVersion: row.feature_set_version,
      completedAt: row.completed_at ?? null,
      createdAt: row.created_at,
    })),
    invention.feature_set_version,
  );
  const matrixPatentSearch = completedSearch ? patentSearchRecord(completedSearch) : null;
  const { data: overlapReportData, error: overlapReportError } = await supabase
    .from("overlap_reports")
    .select("id,patent_search_id,status,feature_set_version,summary,feature_matches,error_message")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const reportRow = overlapReportData as OverlapReportRow | null;
  const { data: completedOverlapData, error: completedOverlapError } = completedSearch
    ? await supabase
      .from("overlap_reports")
      .select("id,patent_search_id,status,feature_set_version,summary,feature_matches,error_message")
      .eq("invention_id", invention.id)
      .eq("patent_search_id", completedSearch.id)
      .eq("user_id", userId)
      .eq("status", "COMPLETED")
      .eq("feature_set_version", invention.feature_set_version)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    : { data: null, error: null };
  const completedOverlap = completedOverlapData as OverlapReportRow | null;
  const currentOverlapReport: OverlapReportRecord | null = completedOverlap ? {
    status: completedOverlap.status,
    featureSetVersion: completedOverlap.feature_set_version,
    summary: completedOverlap.summary,
    featureMatches: completedOverlap.feature_matches,
    errorMessage: completedOverlap.error_message,
  } : null;
  const currentDraftResponse = completedSearch && completedOverlap
    ? await supabase
      .from("patent_drafts")
      .select("id,patent_search_id,overlap_report_id,status,feature_set_version,sections,original_sections,provider_name,provider_version,version,updated_at,error_message")
      .eq("invention_id", invention.id)
      .eq("patent_search_id", completedSearch.id)
      .eq("overlap_report_id", completedOverlap.id)
      .eq("user_id", userId)
      .eq("feature_set_version", invention.feature_set_version)
      .maybeSingle()
    : { data: null, error: null };
  const latestDraftResponse = await supabase
    .from("patent_drafts")
    .select("id,patent_search_id,overlap_report_id,status,feature_set_version,sections,original_sections,provider_name,provider_version,version,updated_at,error_message")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const patentDraftData = currentDraftResponse.data ?? latestDraftResponse.data;
  const patentDraftError = currentDraftResponse.error ?? latestDraftResponse.error;
  const draftRow = patentDraftData as PatentDraftRow | null;
  const patentDraft: PatentDraftRecord | null = draftRow ? {
    id: draftRow.id,
    status: draftRow.status,
    featureSetVersion: draftRow.feature_set_version,
    sections: draftRow.sections,
    originalSections: draftRow.original_sections,
    providerName: draftRow.provider_name,
    providerVersion: draftRow.provider_version,
    version: draftRow.version,
    updatedAt: draftRow.updated_at,
    errorMessage: draftRow.error_message,
  } : null;
  const latestDraftRow = latestDraftResponse.data as PatentDraftRow | null;
  const workflowInput: WorkflowStateInput = {
    detailsComplete: [invention.title, invention.problem_statement, invention.invention_description, invention.development_stage].every((value) => value.trim().length > 0),
    analysisStatus: status,
    hasFeatureCandidates: approvedFeatures.length > 0,
    featuresApproved,
    approvedFeatureSetVersion: invention.feature_set_version,
    latestSearch: searchRow ? { id: searchRow.id, status: searchRow.status, featureSetVersion: searchRow.feature_set_version } : null,
    latestCurrentSearchId: completedSearch?.id ?? null,
    latestOverlapReport: reportRow ? { id: reportRow.id, patentSearchId: reportRow.patent_search_id, status: reportRow.status, featureSetVersion: reportRow.feature_set_version } : null,
    latestCurrentOverlapReportId: completedOverlap?.id ?? null,
    latestDraft: latestDraftRow ? {
      id: latestDraftRow.id,
      patentSearchId: latestDraftRow.patent_search_id,
      overlapReportId: latestDraftRow.overlap_report_id,
      status: latestDraftRow.status,
      featureSetVersion: latestDraftRow.feature_set_version,
      sectionsComplete: hasCompleteDraftSections(latestDraftRow.sections),
    } : null,
    hasUnsavedDraftChanges: false,
  };
  const workflowState = calculateWorkflowState(workflowInput);
  const workspaceSections = buildWorkspaceSectionStates({
    workflow: workflowState,
    analysisStatus: status,
    imageCount: images.length,
    hasPatentResults: Boolean(patentSearch?.status === "COMPLETED" && patentSearch.results.length > 0),
  });
  const defaultWorkspaceSection = recommendedWorkspaceSection(workflowState, status);
  const analysisProvider = (process.env.AI_PROVIDER ?? "mock").toLowerCase() === "openai" ? "openai" : "mock";
  const proposedSolution = text(analysis.proposedSolution) || invention.invention_description;
  const noveltyDescription = text(analysis.noveltyDescription);
  const claimsDraft = text(analysis.claimsDraft) || text(analysis.preliminaryClaims);
  const showCreatedImageHandoff = query.created === "1" && query.section === "images";

  return <DashboardShell>
    <div className="invention-detail-page">
    <div className="invention-detail-heading">
      <Link href="/dashboard" aria-label="Back to dashboard">←</Link>
      <div><p className="eyebrow">PRIVATE INVENTION</p><h1>{invention.title}</h1><Badge tone={invention.development_stage === "concept" ? "neutral" : "success"}>{formatLabel(invention.development_stage)}</Badge></div>
    </div>

    <aside className="workflow-legal-notice" role="note">
      <span aria-hidden="true">!</span>
      <p>Patent searches, overlap assessments, and generated drafts are preliminary automated outputs and require professional review.</p>
    </aside>

    <InventionWorkspace
      sections={workspaceSections}
      defaultSection={defaultWorkspaceSection}
      completionPercentage={workflowState.completionPercentage}
      overview={<div className="workspace-overview">
        <section className="workspace-overview-summary"><div><span className="eyebrow">PRIVATE INVENTION</span><h3>{invention.title}</h3><p>{formatLabel(invention.development_stage)} · Feature set v{invention.feature_set_version}</p></div><span className={`workspace-overview-status status-${status.toLowerCase()}`}>{status === "APPROVED" ? "Features approved" : status === "PROCESSING" ? "Analysis in progress" : status === "FAILED" ? "Analysis error" : status === "NEEDS_REVIEW" ? "Review required" : "Analysis not started"}</span></section>
        <WorkflowProgress compact inventionId={invention.id} input={workflowInput} initialState={workflowState} />
        <dl className="workspace-version-summary"><div><dt>Current features</dt><dd>v{invention.feature_set_version}</dd></div><div><dt>Latest search</dt><dd>{searchRow ? `Feature set v${searchRow.feature_set_version}` : "Not created"}</dd></div><div><dt>Latest report</dt><dd>{reportRow ? `Feature set v${reportRow.feature_set_version}` : "Not created"}</dd></div><div><dt>Latest draft</dt><dd>{latestDraftRow ? `Draft v${latestDraftRow.version}` : "Not created"}</dd></div></dl>
        <section className="invention-danger-zone"><div><span className="eyebrow">DANGER ZONE</span><h3>Delete this invention</h3><p>Permanently remove this invention and all related private workflow records.</p></div><DeleteInventionDialog inventionId={invention.id} inventionTitle={invention.title} /></section>
      </div>}
      details={<InventionDetailsEditor details={{
        id: invention.id,
        title: invention.title,
        problemStatement: invention.problem_statement,
        inventionDescription: proposedSolution,
        noveltyDescription,
        claimsDraft,
        developmentStage: invention.development_stage as "concept" | "prototype" | "testing" | "production",
        publiclyDisclosed: invention.publicly_disclosed,
        previouslySold: invention.previously_sold,
        previouslyFiled: invention.previously_filed,
        preferredLanguage: normalizePreferredLanguage(invention.preferred_language),
      }} />}
      images={<>{showCreatedImageHandoff && <CreationImageHandoff inventionId={invention.id} />}{imagesError && <div className="image-action-error detail-image-error" role="alert">{imagesError}</div>}{!imageError && <InventionImages inventionId={invention.id} images={images} />}</>}
      technicalReview={<div className="workspace-technical-review"><InventionAnalysis inventionId={invention.id} status={status} aiAnalysis={invention.ai_analysis} approvedFeatures={invention.approved_features} featureSetVersion={invention.feature_set_version} providerName={analysisProvider} />{(status === "NEEDS_REVIEW" || status === "APPROVED") && <ClarificationReview inventionId={invention.id} clarification={clarification} />}</div>}
      priorArt={<PatentSearch inventionId={invention.id} featuresApproved={featuresApproved} approvedFeatures={approvedFeatures} search={patentSearch} matrixSearch={matrixPatentSearch} currentFeatureSetVersion={invention.feature_set_version} existingOverlapMatches={completedOverlap?.feature_matches ?? null} loadError={patentSearchError || completedSearchError ? "Previous patent searches could not be loaded." : undefined} />}
      overlap={<OverlapReportPanel inventionId={invention.id} featuresApproved={featuresApproved} hasCompletedSearch={Boolean(completedSearch)} report={currentOverlapReport} currentFeatureSetVersion={invention.feature_set_version} currentSearch={matrixPatentSearch ? { featureSetVersion: matrixPatentSearch.featureSetVersion, completedAt: matrixPatentSearch.completedAt, patentCount: matrixPatentSearch.results.length } : null} loadError={completedSearchError || overlapReportError ? "Previous overlap reports could not be loaded." : undefined} />}
      drafting={<PatentDraftPanel key={patentDraft ? `${patentDraft.id}-${patentDraft.version}` : "empty-draft"} inventionId={invention.id} featuresApproved={featuresApproved} hasCompletedSearch={Boolean(completedSearch)} hasMatchingOverlapReport={Boolean(completedOverlap)} draft={patentDraft} currentFeatureSetVersion={invention.feature_set_version} loadError={completedOverlapError || patentDraftError ? "The patent draft could not be loaded. Apply the patent-drafts migrations if they are not installed." : undefined} />}
      activity={<Suspense fallback={<InventionTimelineLoading />}><InventionTimelineServer inventionId={invention.id} userId={userId} /></Suspense>}
    />
    </div>
  </DashboardShell>;
}
