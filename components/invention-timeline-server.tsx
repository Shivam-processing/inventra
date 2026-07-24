import { InventionTimeline } from "@/components/invention-timeline";
import { buildInventionTimeline } from "@/lib/patents/invention-timeline";
import { createClient } from "@/lib/supabase/server";

type InventionRow = {
  created_at: string | null;
  updated_at: string | null;
  ai_status: string | null;
  feature_set_version: number;
  approved_features: unknown;
  clarification_questions: unknown;
};

type SearchRow = {
  id: string;
  status: string;
  feature_set_version: number;
  created_at: string | null;
  updated_at: string | null;
};

type ReportRow = SearchRow & { patent_search_id: string };

type DraftRow = SearchRow & {
  patent_search_id: string;
  overlap_report_id: string;
  version: number;
  acknowledgement_at: string | null;
  sections: unknown;
  original_sections: unknown;
};

function featureCount(value: unknown) {
  return Array.isArray(value) ? value.filter((feature) => typeof feature === "string" && feature.trim().length > 0).length : 0;
}

function edited(sections: unknown, originalSections: unknown) {
  return JSON.stringify(sections) !== JSON.stringify(originalSections);
}

export async function InventionTimelineServer({ inventionId, userId }: { inventionId: string; userId: string }) {
  const supabase = await createClient();
  const [inventionResult, searchesResult, reportsResult, draftsResult] = await Promise.all([
    supabase
      .from("invention_cases")
      .select("created_at,updated_at,ai_status,feature_set_version,approved_features,clarification_questions")
      .eq("id", inventionId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("patent_searches")
      .select("id,status,feature_set_version,created_at,updated_at")
      .eq("invention_id", inventionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("overlap_reports")
      .select("id,patent_search_id,status,feature_set_version,created_at,updated_at")
      .eq("invention_id", inventionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("patent_drafts")
      .select("id,patent_search_id,overlap_report_id,status,feature_set_version,version,acknowledgement_at,sections,original_sections,created_at,updated_at")
      .eq("invention_id", inventionId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const invention = inventionResult.data as InventionRow | null;
  const events = buildInventionTimeline({
    invention: invention ? {
      createdAt: invention.created_at,
      updatedAt: invention.updated_at,
      aiStatus: invention.ai_status,
      featureSetVersion: invention.feature_set_version,
      approvedFeatureCount: featureCount(invention.approved_features),
      clarification: invention.clarification_questions,
    } : null,
    searches: ((searchesResult.data ?? []) as SearchRow[]).map((search) => ({
      id: search.id,
      status: search.status,
      featureSetVersion: search.feature_set_version,
      createdAt: search.created_at,
      updatedAt: search.updated_at,
    })),
    reports: ((reportsResult.data ?? []) as ReportRow[]).map((report) => ({
      id: report.id,
      patentSearchId: report.patent_search_id,
      status: report.status,
      featureSetVersion: report.feature_set_version,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    })),
    drafts: ((draftsResult.data ?? []) as DraftRow[]).map((draft) => ({
      id: draft.id,
      patentSearchId: draft.patent_search_id,
      overlapReportId: draft.overlap_report_id,
      status: draft.status,
      featureSetVersion: draft.feature_set_version,
      version: draft.version,
      createdAt: draft.created_at,
      updatedAt: draft.updated_at,
      acknowledgementAt: draft.acknowledgement_at,
      edited: edited(draft.sections, draft.original_sections),
    })),
  });
  const loadError = inventionResult.error || searchesResult.error || reportsResult.error || draftsResult.error
    ? "Some timeline activity could not be loaded. Refresh to retry."
    : undefined;

  return <InventionTimeline events={events} loadError={loadError} />;
}
