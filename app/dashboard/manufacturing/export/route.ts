import "server-only";

import { renderManufacturingPlanPdf, manufacturingPlanFilename } from "@/lib/manufacturing/report";
import { storedManufacturingAnalysis } from "@/lib/manufacturing/storage";
import { manufacturingExportInputSchema } from "@/lib/manufacturing/validation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_BYTES = 4096;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function error(message: string, status: number) { return Response.json({ error: message }, { status, headers }); }

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_BYTES) return error("Invalid manufacturing export request.", 413);
  let body: unknown;
  try { const raw = await request.text(); if (raw.length > MAX_BYTES) return error("Invalid manufacturing export request.", 413); body = JSON.parse(raw); } catch { return error("Invalid manufacturing export request.", 400); }
  const parsed = manufacturingExportInputSchema.safeParse(body);
  if (!parsed.success) return error("Invalid manufacturing export request.", 400);
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || !userId) return error("Sign in to download this manufacturing plan.", 401);
  const { data: invention } = await supabase.from("invention_cases").select("id,title,feature_set_version").eq("id", parsed.data.inventionId).eq("user_id", userId).maybeSingle();
  if (!invention) return error("The owned invention record is unavailable.", 404);
  const { data: row } = await supabase.from("manufacturing_analyses").select("*").eq("id", parsed.data.analysisId).eq("invention_id", invention.id).eq("user_id", userId).eq("status", "COMPLETED").maybeSingle();
  const analysis = row ? storedManufacturingAnalysis(row, invention.feature_set_version) : null;
  if (!analysis?.analysisResult) return error("The saved manufacturing plan is unavailable.", 404);
  if (analysis.isOutdated) return error("Generate a manufacturing plan for the current feature set before exporting.", 409);
  try {
    const bytes = await renderManufacturingPlanPdf(invention.title, analysis);
    if (bytes.byteLength < 4 || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") return error("The manufacturing plan PDF could not be generated. Please retry.", 500);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, { status: 200, headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${manufacturingPlanFilename(invention.title)}"`, "Content-Length": String(bytes.byteLength) } });
  } catch (caught) {
    console.error("[manufacturing-export] PDF generation failed", { type: caught instanceof Error ? caught.name : "UnknownError" });
    return error("The manufacturing plan PDF could not be generated. Please retry.", 500);
  }
}
