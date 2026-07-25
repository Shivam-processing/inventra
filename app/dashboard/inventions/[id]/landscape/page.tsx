import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard-shell";
import { PatentLandscape } from "@/components/patent-landscape";
import { buildPatentLandscape } from "@/lib/patents/patent-landscape";
import { parseOverlapMatches, parsePatentResults } from "@/lib/reports/full-report-utils";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Patent Landscape" };

function EmptyLandscape({ inventionId, title, message }: { inventionId: string; title: string; message: string }) {
  return <DashboardShell><main className="new-invention-heading"><Link href={`/dashboard/inventions/${inventionId}?section=prior-art`} aria-label="Back to patent search">←</Link><div><p className="eyebrow">PATENT LANDSCAPE</p><h1>{title}</h1><p>{message}</p><Link className="button button-default" href={`/dashboard/inventions/${inventionId}?section=prior-art`}>Return to Patent Search</Link></div></main></DashboardShell>;
}

export default async function PatentLandscapePage({ params }: { params: Promise<{ id: string }> }) {
  const parsedId = z.string().uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,ai_status,approved_features,feature_set_version")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (inventionError || !invention) notFound();
  const features = Array.isArray(invention.approved_features) ? invention.approved_features.filter((feature): feature is string => typeof feature === "string" && Boolean(feature.trim())).map((feature) => feature.trim()) : [];
  if (invention.ai_status !== "APPROVED" || !features.length) return <EmptyLandscape inventionId={invention.id} title="Approve features first" message="A current approved feature set is required before the patent landscape can be visualised." />;

  const { data: search, error: searchError } = await supabase
    .from("patent_searches")
    .select("id,invention_id,user_id,status,feature_set_version,results,created_at")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (searchError || !search) return <EmptyLandscape inventionId={invention.id} title="No current patent search" message="Run a patent search for the current approved feature set to create this landscape." />;

  const { data: report, error: reportError } = await supabase
    .from("overlap_reports")
    .select("id,invention_id,patent_search_id,user_id,status,feature_set_version,feature_matches")
    .eq("invention_id", invention.id)
    .eq("patent_search_id", search.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError || !report) return <EmptyLandscape inventionId={invention.id} title="No current overlap report" message="Generate an overlap report for the latest current patent search before opening the landscape." />;
  if (search.invention_id !== invention.id || search.user_id !== userId || report.invention_id !== invention.id || report.user_id !== userId || report.patent_search_id !== search.id || search.feature_set_version !== invention.feature_set_version || report.feature_set_version !== invention.feature_set_version) {
    return <EmptyLandscape inventionId={invention.id} title="Landscape data is outdated" message="Generate current patent-search and overlap records before visualising the landscape." />;
  }

  const patents = buildPatentLandscape(features, parsePatentResults(search.results), parseOverlapMatches(report.feature_matches));
  if (!patents.length) return <EmptyLandscape inventionId={invention.id} title="No patents to visualise" message="The current completed search contains no stored patent results." />;

  return <DashboardShell><PatentLandscape inventionId={invention.id} inventionTitle={invention.title} featureSetVersion={invention.feature_set_version} searchDate={search.created_at} patents={patents} /></DashboardShell>;
}
