import { savedPatentDraftSectionsSchema } from "@/lib/patents/patent-draft-export";
import { parseClarificationState } from "@/lib/ai/clarification";
import { selectLatestCompletedPatentSearch } from "@/lib/patents/feature-comparison";
import { createPatentDraftFigures } from "@/lib/patents/patent-draft-drawings";
import { renderFullReportPdf, type FullReportData } from "@/lib/reports/full-report-document";
import {
  createReportCode,
  authenticatedUserId,
  fullReportRequestSchema,
  fullReportResponseHeaders,
  hasPdfSignature,
  parseOverlapMatches,
  parsePatentResults,
  reportFilename,
  sanitizePdfText,
  validateCurrentReportWorkflow,
} from "@/lib/reports/full-report-utils";
import { createClient } from "@/lib/supabase/server";
import { uniqueSentences } from "@/lib/voice/transcript-review";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 4096;
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: privateHeaders });
}

function responseBody(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return jsonError("Invalid full-report request.", 413);

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) return jsonError("Invalid full-report request.", 413);
    body = JSON.parse(rawBody);
  } catch {
    return jsonError("Invalid full-report request.", 400);
  }
  const input = fullReportRequestSchema.safeParse(body);
  if (!input.success) return jsonError("Enter a valid invention ID to generate this report.", 400);

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = authenticatedUserId(claimsError, claimsData?.claims?.sub);
  if (!userId) return jsonError("Sign in to download the full analysis report.", 401);

  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,user_id,title,problem_statement,invention_description,ai_status,ai_analysis,approved_features,feature_set_version,clarification_questions")
    .eq("id", input.data.inventionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (inventionError || !invention) return jsonError("The owned invention record is unavailable.", 404);

  const approvedFeatures = stringList(invention.approved_features);
  if (invention.ai_status !== "APPROVED" || !approvedFeatures.length) {
    return jsonError("Approve the current feature set before generating a full report.", 409);
  }

  const { data: searchRows, error: searchError } = await supabase
    .from("patent_searches")
    .select("*")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false });
  const search = selectLatestCompletedPatentSearch(
    (searchRows ?? []).map((row) => ({ ...row, featureSetVersion: row.feature_set_version, completedAt: typeof row.completed_at === "string" ? row.completed_at : null, createdAt: typeof row.created_at === "string" ? row.created_at : null })),
    invention.feature_set_version,
  );
  if (searchError || !search) return jsonError("A current completed patent search is required for this report.", 409);

  const { data: report, error: reportError } = await supabase
    .from("overlap_reports")
    .select("id,invention_id,patent_search_id,user_id,status,feature_set_version,feature_matches,created_at")
    .eq("invention_id", invention.id)
    .eq("patent_search_id", search.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError || !report) return jsonError("A current completed overlap report is required for this report.", 409);

  const { data: draft, error: draftError } = await supabase
    .from("patent_drafts")
    .select("id,invention_id,patent_search_id,overlap_report_id,user_id,status,feature_set_version,sections,provider_name,provider_version,version,updated_at")
    .eq("invention_id", invention.id)
    .eq("patent_search_id", search.id)
    .eq("overlap_report_id", report.id)
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .eq("feature_set_version", invention.feature_set_version)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (draftError || !draft) return jsonError("A current saved patent draft is required for this report.", 409);

  if (!validateCurrentReportWorkflow({
    inventionId: invention.id,
    userId,
    featureSetVersion: invention.feature_set_version,
    search,
    report,
    draft,
  })) return jsonError("The saved workflow records are outdated or mismatched. Refresh them before generating a report.", 409);

  const draftSections = savedPatentDraftSectionsSchema.safeParse(draft.sections);
  if (!draftSections.success) return jsonError("Complete and save every required draft section before generating a report.", 422);

  const patentResults = parsePatentResults(search.results);
  const overlapMatches = parseOverlapMatches(report.feature_matches);
  if (!patentResults.length || !overlapMatches.length) {
    return jsonError("The current search and overlap report do not contain enough saved data to generate a report.", 422);
  }

  const analysis = record(invention.ai_analysis);
  const clarification = parseClarificationState(invention.clarification_questions);
  const claimMetadata = record(claimsData?.claims?.user_metadata);
  let inventorName = text(claimMetadata.full_name);
  if (!inventorName) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    inventorName = text(profile?.full_name);
  }

  const { data: imageRows } = await supabase
    .from("invention_images")
    .select("storage_path,original_name,image_type")
    .eq("invention_id", invention.id)
    .eq("user_id", userId)
    .order("id", { ascending: true });
  const figureMetadata = createPatentDraftFigures((imageRows ?? []).map((image) => text(image.image_type) || "Other"));
  const images = await Promise.all((imageRows ?? []).map(async (image, index) => {
    const figure = figureMetadata[index];
    const caption = sanitizePdfText(figure.caption);
    const category = sanitizePdfText(text(image.image_type) || "Other");
    try {
      const { data, error } = await supabase.storage.from("invention-images").download(image.storage_path);
      if (error || !data || (data.type !== "image/jpeg" && data.type !== "image/png")) return { figureNumber: figure.figureNumber, caption, category, dataUri: null };
      const bytes = Buffer.from(await data.arrayBuffer());
      return { figureNumber: figure.figureNumber, caption, category, dataUri: `data:${data.type};base64,${bytes.toString("base64")}` };
    } catch {
      return { figureNumber: figure.figureNumber, caption, category, dataUri: null };
    }
  }));

  const generatedAt = new Date();
  const storedDescription = sanitizePdfText(text(invention.invention_description) || "Not provided");
  const inventionDescription = uniqueSentences(storedDescription) || storedDescription;
  const proposedSolution = uniqueSentences(sanitizePdfText(text(analysis.proposedSolution)), inventionDescription) || "No separate proposed-solution wording was stored.";
  const reportData: FullReportData = {
    reportCode: createReportCode(generatedAt, `${invention.id}:${draft.version}`),
    generatedAt: generatedAt.toISOString(),
    inventorName: sanitizePdfText(inventorName || "Not provided"),
    inventionTitle: sanitizePdfText(text(invention.title) || "Untitled invention"),
    inventionDescription,
    problemStatement: sanitizePdfText(text(invention.problem_statement) || "Not provided"),
    proposedSolution,
    noveltyDescription: sanitizePdfText(text(analysis.noveltyDescription) || "Not provided"),
    clarificationAnswers: clarification?.items.filter((item) => !item.skipped && item.answer.trim()).map((item) => ({ question: sanitizePdfText(item.question), answer: sanitizePdfText(item.answer) })) ?? [],
    images,
    approvedFeatures: approvedFeatures.map(sanitizePdfText),
    featureSetVersion: invention.feature_set_version,
    patentResults: patentResults.map((patent) => ({ ...patent, title: sanitizePdfText(patent.title), publicationNumber: sanitizePdfText(patent.publicationNumber), applicant: patent.applicant ? sanitizePdfText(patent.applicant) : null, abstract: patent.abstract ? sanitizePdfText(patent.abstract) : null })),
    overlapMatches: overlapMatches.map((match) => ({ ...match, feature: sanitizePdfText(match.feature), matchedPatentTitle: match.matchedPatentTitle ? sanitizePdfText(match.matchedPatentTitle) : null, publicationNumber: match.publicationNumber ? sanitizePdfText(match.publicationNumber) : null, matchedKeywords: match.matchedKeywords.map(sanitizePdfText), matchedConcepts: match.matchedConcepts?.map(sanitizePdfText), missingConcepts: match.missingConcepts?.map(sanitizePdfText), explanation: sanitizePdfText(match.explanation) })),
    draftVersion: draft.version,
    draftSavedAt: draft.updated_at,
    providerName: sanitizePdfText(text(draft.provider_name) || "Not provided"),
    providerVersion: sanitizePdfText(text(draft.provider_version)),
    draftSections: Object.fromEntries(Object.entries(draftSections.data).map(([key, value]) => [key, sanitizePdfText(value)])) as typeof draftSections.data,
  };

  try {
    const bytes = await renderFullReportPdf(reportData);
    if (!hasPdfSignature(bytes)) throw new Error("invalid_pdf_signature");
    const filename = reportFilename(reportData.inventionTitle, reportData.draftVersion);
    return new Response(responseBody(bytes), { status: 200, headers: fullReportResponseHeaders(filename, bytes.byteLength) });
  } catch (error) {
    console.error("[full-analysis-report] PDF generation failed", { type: error instanceof Error ? error.name : "unknown_error" });
    return jsonError("The full analysis report could not be generated. Please retry.", 500);
  }
}
