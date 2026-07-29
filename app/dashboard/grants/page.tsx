import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DashboardShell } from "@/components/dashboard-shell";
import { GrantFinder, type GrantInventionOption } from "@/components/grant-finder";
import { classifyInvention } from "@/lib/grants/classifier";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Government Grants & Schemes" };

export default async function GrantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requested = typeof query.invention === "string" ? query.invention : null;
  if (requested && !z.string().uuid().safeParse(requested).success) notFound();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/login");
  const { data, error } = await supabase.from("invention_cases")
    .select("id,title,problem_statement,invention_description,development_stage,ai_status,ai_analysis,approved_features,clarification_questions,updated_at")
    .eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load inventions for grant matching.");
  const inventions = (data ?? []).map((row) => {
    const analysis = row.ai_analysis && typeof row.ai_analysis === "object" && !Array.isArray(row.ai_analysis) ? row.ai_analysis as Record<string, unknown> : {};
    const text = (value: unknown) => typeof value === "string" ? value : "";
    const detected = classifyInvention({ title: row.title, problemStatement: row.problem_statement, proposedSolution: text(analysis.proposedSolution) || row.invention_description, noveltyDescription: text(analysis.noveltyDescription), technicalField: text(analysis.technicalField), approvedFeatures: Array.isArray(row.approved_features) ? row.approved_features.filter((item): item is string => typeof item === "string") : [], developmentStage: row.development_stage, clarificationAnswers: [] });
    return { id: row.id, title: row.title, development_stage: row.development_stage, ai_status: row.ai_status, updated_at: row.updated_at, detectedDomains: detected.domains } satisfies GrantInventionOption;
  });
  if (requested && !inventions.some((item) => item.id === requested)) notFound();
  return <DashboardShell><GrantFinder inventions={inventions} initialInventionId={requested} liveEnabled={(process.env.GRANT_SEARCH_PROVIDER ?? "curated") === "openai_web"} /></DashboardShell>;
}
