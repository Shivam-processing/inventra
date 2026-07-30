import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard-shell";
import { PatentCostEstimator } from "@/components/patent-cost-estimator";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Patent cost estimator" };

export default async function PatentCostEstimatorPage({ params }: { params: Promise<{ id: string }> }) {
  const parsedId = z.string().uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: invention, error } = await supabase
    .from("invention_cases")
    .select("id,title")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !invention) notFound();

  const { data: draft } = await supabase
    .from("patent_drafts")
    .select("sections")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sections = draft?.sections && typeof draft.sections === "object" && !Array.isArray(draft.sections)
    ? draft.sections as Record<string, unknown>
    : {};
  const drawingText = typeof sections.briefDescriptionOfDrawings === "string" ? sections.briefDescriptionOfDrawings : "";
  const figureNumbers = new Set([...drawingText.matchAll(/\bFIG\.\s*(\d+)\b/gi)].map((match) => match[1]));
  const initialDrawingCount = Math.min(100, figureNumbers.size);

  return <DashboardShell>
    <main className="cost-estimator-page">
      <div className="new-invention-heading">
        <Link href={`/dashboard/inventions/${invention.id}?section=export`} aria-label={`Back to ${invention.title}`}>←</Link>
        <div><p className="eyebrow">PATENT COST ESTIMATOR</p><h1>Estimate filing costs.</h1><p>Compare simplified educational ranges for {invention.title} across selected jurisdictions.</p></div>
      </div>
      <PatentCostEstimator initialDrawingCount={initialDrawingCount} />
    </main>
  </DashboardShell>;
}
