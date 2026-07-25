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

  return <DashboardShell>
    <main className="cost-estimator-page">
      <div className="new-invention-heading">
        <Link href={`/dashboard/inventions/${invention.id}?section=export`} aria-label={`Back to ${invention.title}`}>←</Link>
        <div><p className="eyebrow">PATENT COST ESTIMATOR</p><h1>Estimate filing costs.</h1><p>Compare simplified educational ranges for {invention.title} across selected jurisdictions.</p></div>
      </div>
      <PatentCostEstimator />
    </main>
  </DashboardShell>;
}
