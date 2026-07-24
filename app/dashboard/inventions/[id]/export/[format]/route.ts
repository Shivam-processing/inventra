import { z } from "zod";
import {
  createPatentDraftDocx,
  createPatentDraftPdf,
  patentDraftFilename,
  savedPatentDraftSectionsSchema,
  type PatentDraftExportData,
} from "@/lib/patents/patent-draft-export";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid(), format: z.enum(["docx", "pdf"]) });
const requestSchema = z.object({ draftId: z.string().uuid(), version: z.number().int().positive() });
const MAX_REQUEST_BYTES = 4096;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function responseBody(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; format: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError("Invalid patent draft export request.", 400);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return jsonError("Invalid patent draft export request.", 413);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) return jsonError("Invalid patent draft export request.", 413);
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("Invalid patent draft export request.", 400);
  }
  const input = requestSchema.safeParse(body);
  if (!input.success) return jsonError("Invalid patent draft export request.", 400);

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return jsonError("Sign in to export this patent draft.", 401);

  const { data: draft, error: draftError } = await supabase
    .from("patent_drafts")
    .select("id,invention_id,patent_search_id,overlap_report_id,user_id,status,version,feature_set_version,sections,updated_at")
    .eq("id", input.data.draftId)
    .eq("invention_id", params.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (draftError || !draft) return jsonError("Patent draft not found.", 404);
  if (draft.status !== "COMPLETED") return jsonError("The saved patent draft is not ready to export.", 409);
  if (draft.version !== input.data.version) return jsonError("The patent draft changed. Reload before exporting.", 409);

  const sections = savedPatentDraftSectionsSchema.safeParse(draft.sections);
  if (!sections.success) return jsonError("Complete and save every required draft section before exporting.", 422);

  const [{ data: invention }, { data: patentSearch }, { data: overlapReport }] = await Promise.all([
    supabase
      .from("invention_cases")
      .select("id,title,development_stage,publicly_disclosed,previously_sold,previously_filed,ai_status,feature_set_version")
      .eq("id", draft.invention_id)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("patent_searches")
      .select("id,feature_set_version")
      .eq("id", draft.patent_search_id)
      .eq("invention_id", draft.invention_id)
      .eq("user_id", userId)
      .eq("status", "COMPLETED")
      .maybeSingle(),
    supabase
      .from("overlap_reports")
      .select("id,feature_set_version")
      .eq("id", draft.overlap_report_id)
      .eq("patent_search_id", draft.patent_search_id)
      .eq("invention_id", draft.invention_id)
      .eq("user_id", userId)
      .eq("status", "COMPLETED")
      .maybeSingle(),
  ]);
  if (!invention || !patentSearch || !overlapReport) {
    return jsonError("The owned source records for this draft are unavailable.", 403);
  }
  if (
    invention.ai_status !== "APPROVED"
    || draft.feature_set_version !== invention.feature_set_version
    || patentSearch.feature_set_version !== invention.feature_set_version
    || overlapReport.feature_set_version !== invention.feature_set_version
  ) {
    return jsonError("This draft is outdated. Generate a draft for the current approved feature set before exporting.", 409);
  }

  const { data: latestSearch, error: latestSearchError } = await supabase
    .from("patent_searches")
    .select("id")
    .eq("invention_id", draft.invention_id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestSearchError || latestSearch?.id !== draft.patent_search_id) {
    return jsonError("This draft belongs to an older patent search and cannot be exported as current.", 409);
  }

  const { data: latestOverlap, error: latestOverlapError } = await supabase
    .from("overlap_reports")
    .select("id")
    .eq("invention_id", draft.invention_id)
    .eq("patent_search_id", draft.patent_search_id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestOverlapError || latestOverlap?.id !== draft.overlap_report_id) {
    return jsonError("This draft belongs to an older overlap report and cannot be exported as current.", 409);
  }

  const exportData: PatentDraftExportData = {
    inventionTitle: invention.title,
    developmentStage: invention.development_stage,
    publiclyDisclosed: invention.publicly_disclosed,
    previouslySold: invention.previously_sold,
    previouslyFiled: invention.previously_filed,
    draftVersion: draft.version,
    savedAt: draft.updated_at,
    sections: sections.data,
  };

  try {
    const bytes = params.data.format === "docx"
      ? await createPatentDraftDocx(exportData)
      : await createPatentDraftPdf(exportData);
    const filename = patentDraftFilename(invention.title, draft.version, params.data.format);
    const contentType = params.data.format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    return new Response(responseBody(bytes), {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[patent-draft-export] Document generation failed", {
      type: error instanceof Error ? error.name : "unknown_error",
    });
    return jsonError(`The ${params.data.format.toUpperCase()} export could not be generated. Please retry.`, 500);
  }
}
