import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TrademarkSearchWorkspace, type TrademarkInventionOption } from "@/components/trademark-search-workspace";
import { storedTrademarkHistory } from "@/lib/trademarks/history";
import { resolveOwnedTrademarkSelection } from "@/lib/trademarks/selection";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trademark Search & Conflict Analysis" };
export const dynamic = "force-dynamic";
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []; }

export default async function TrademarksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams; const requested = typeof query.invention === "string" ? query.invention : null; const supabase = await createClient(); const { data: auth } = await supabase.auth.getClaims(); const userId = auth?.claims?.sub; if (!userId) redirect("/login");
  const { data, error } = await supabase.from("invention_cases").select("id,title,problem_statement,invention_description,development_stage,ai_analysis,approved_features,updated_at,proposed_brand_name").eq("user_id", userId).order("updated_at", { ascending: false }); if (error) throw new Error("Unable to load owned inventions for trademark screening.");
  const inventions = (data ?? []).map((row) => { const analysis = record(row.ai_analysis); const solution = text(analysis.proposedSolution) || text(row.invention_description); const technicalField = text(analysis.technicalField); const features = strings(row.approved_features).slice(0, 4); const contextParts = [row.title, row.problem_statement, solution, technicalField, ...features].filter(Boolean); return { id: row.id, title: row.title, developmentStage: row.development_stage, updatedAt: row.updated_at, proposedBrandName: typeof row.proposed_brand_name === "string" ? row.proposed_brand_name : null, suggestedDescription: [`Product: ${row.title}.`, solution && `Purpose: ${solution}`, features.length && `Key characteristics: ${features.join("; ")}.`].filter(Boolean).join(" ").slice(0, 1500), classContext: contextParts.join(" ").slice(0, 5000) } satisfies TrademarkInventionOption; });
  const selection = resolveOwnedTrademarkSelection(requested, inventions.map((item) => item.id)); const validRequested = selection.inventionId; const selectionError = selection.error;
  const { data: rows, error: historyError } = await supabase.from("trademark_searches").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100); if (historyError) throw new Error("Unable to load trademark history. Apply the trademark migration and retry.");
  const titleById = new Map(inventions.map((item) => [item.id, item.title])); const providerVersion = "1.0.0"; const history = (rows ?? []).map((row) => storedTrademarkHistory(row, typeof row.invention_id === "string" ? titleById.get(row.invention_id) ?? null : null, providerVersion)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  return <DashboardShell><TrademarkSearchWorkspace inventions={inventions} initialInventionId={validRequested} initialHistory={history} initialError={selectionError} providerVersion={providerVersion} /></DashboardShell>;
}
