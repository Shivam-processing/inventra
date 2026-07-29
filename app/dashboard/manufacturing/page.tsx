import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ManufacturingFinder, type ManufacturingInventionOption } from "@/components/manufacturing-finder";
import { resolveOwnedManufacturingSelection } from "@/lib/manufacturing/selection";
import { storedManufacturingAnalysis } from "@/lib/manufacturing/storage";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manufacturing & Suppliers" };
export const dynamic = "force-dynamic";

export default async function ManufacturingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const rawRequested = typeof query.invention === "string" ? query.invention : null;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login");
  const { data, error } = await supabase.from("invention_cases")
    .select("id,title,development_stage,feature_set_version,updated_at,ai_status")
    .eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load inventions for manufacturing planning.");
  const inventions = (data ?? []).map((row) => ({
    id: row.id, title: row.title, developmentStage: row.development_stage, featureSetVersion: row.feature_set_version,
    updatedAt: row.updated_at, featuresApproved: row.ai_status === "APPROVED",
  } satisfies ManufacturingInventionOption));
  const selection = resolveOwnedManufacturingSelection(rawRequested, inventions.map((item) => item.id));
  const selected = selection.inventionId ? inventions.find((item) => item.id === selection.inventionId) ?? null : null;
  let initialAnalysis = null;
  if (selected) {
    const { data: analysisRows } = await supabase.from("manufacturing_analyses").select("*")
      .eq("user_id", userId).eq("invention_id", selected.id).eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(1);
    initialAnalysis = analysisRows?.[0] ? storedManufacturingAnalysis(analysisRows[0], selected.featureSetVersion) : null;
  }
  return <DashboardShell><ManufacturingFinder key={selected?.id ?? "no-selection"} inventions={inventions} initialInventionId={selected?.id ?? null} initialAnalysis={initialAnalysis} initialError={selection.error} liveSupplierEnabled={(process.env.MANUFACTURING_SUPPLIER_SEARCH_PROVIDER ?? "curated") === "openai_web"} /></DashboardShell>;
}
