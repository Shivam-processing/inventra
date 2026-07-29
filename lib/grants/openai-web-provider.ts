import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { validatedOfficialUrl } from "./domain-validator";
import type { GovernmentScheme, InventionDomain, OfficialSource, ProgrammeType } from "./types";

const nullableText = z.string().trim().min(1).nullable();
const liveSchemeSchema = z.object({
  schemeName: z.string().trim().min(2).max(300), agency: z.string().trim().min(2).max(300), ministry: nullableText,
  programmeType: z.enum(["DIRECT_GRANT", "PROTOTYPE_SUPPORT", "RESEARCH_GRANT", "LOAN", "CREDIT_GUARANTEE", "INDIRECT_INVESTMENT", "FELLOWSHIP", "INCUBATION_SUPPORT", "IP_SUPPORT", "COMPETITION", "MARKET_ACCESS", "OTHER"]),
  supportType: z.array(z.string().trim().min(1).max(80)).max(10), fundingLabel: z.string().trim().min(2).max(500), maximumDirectGrantInr: z.number().nonnegative().nullable(),
  eligibilityRequirements: z.array(z.string().trim().min(2).max(500)).max(15), supportedDomains: z.array(z.enum(["HEALTHCARE", "MEDTECH", "BIOTECH", "AGRITECH", "FOOD_TECH", "CLEANTECH", "WATER", "WASTE_MANAGEMENT", "ENERGY", "RENEWABLE_ENERGY", "HARDWARE", "ELECTRONICS", "IOT", "SOFTWARE", "AI", "CYBERSECURITY", "MANUFACTURING", "MATERIALS", "SOCIAL_IMPACT", "EDUCATION", "MOBILITY", "DEFENCE", "SPACE", "FINTECH", "GENERAL_INNOVATION"])).max(12),
  supportedStages: z.array(z.string().trim().min(1).max(80)).max(10), applicationMethod: z.string().trim().min(2).max(500), applicationSteps: z.array(z.string().trim().min(2).max(500)).max(12), officialPortal: nullableText,
  sourceUrls: z.array(z.object({ title: z.string().trim().min(1).max(300), url: z.string().url() })).max(12), fundingEvidence: nullableText, eligibilityEvidence: nullableText, activeStatusEvidence: nullableText, deadline: nullableText, deadlineEvidence: nullableText, pageDate: nullableText,
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]), verificationWarnings: z.array(z.string().trim().min(2).max(500)).max(10), matchReason: z.string().trim().min(2).max(800),
});
const liveResultSchema = z.object({ schemes: z.array(liveSchemeSchema).max(12) });
type LiveRaw = z.infer<typeof liveSchemeSchema>;

const OFFICIAL_DOMAINS = ["startupindia.gov.in", "dst.gov.in", "nidhi.dst.gov.in", "birac.nic.in", "msme.gov.in", "cgtmse.in", "sidbi.in", "sidbivcf.in", "aim.gov.in", "niti.gov.in", "meity.gov.in", "msh.meity.gov.in", "tdb.gov.in", "ipindia.gov.in", "gov.in", "nic.in"];
const INSTRUCTIONS = `Use web search and current official Indian government sources only. Return structured results. Never rely on memory for amounts, deadlines, active-call status, direct application links, or eligibility. Use null when official information is absent. Never claim guaranteed eligibility or funding. A funding amount needs explicit funding evidence and an official source. An active deadline needs explicit official evidence and must not have passed. Do not include private schemes or unofficial summaries.`;

export class GrantWebSearchError extends Error {}

function deadlineStatus(raw: LiveRaw) {
  if (!raw.deadline || !raw.deadlineEvidence || !raw.activeStatusEvidence) return { deadlineStatus: "NO_ACTIVE_DEADLINE_VERIFIED" as const, currentlyOpenStatus: "NOT_VERIFIED" as const, deadlineText: "No active deadline verified — check the official portal." };
  const parsed = new Date(raw.deadline);
  if (!Number.isNaN(parsed.valueOf()) && parsed.valueOf() < Date.now()) return { deadlineStatus: "CLOSED" as const, currentlyOpenStatus: "CLOSED" as const, deadlineText: raw.deadline };
  return { deadlineStatus: "VERIFIED_OPEN" as const, currentlyOpenStatus: "VERIFIED_OPEN" as const, deadlineText: raw.deadline };
}

export function normalizeLiveScheme(raw: LiveRaw, checkedAt: string): GovernmentScheme | null {
  const officialSources: OfficialSource[] = raw.sourceUrls.flatMap(({ title, url }) => {
    const parsed = validatedOfficialUrl(url);
    return parsed ? [{ title, url: parsed.toString(), hostname: parsed.hostname, checkedAt }] : [];
  });
  if (!officialSources.length) return null;
  const portal = raw.officialPortal && validatedOfficialUrl(raw.officialPortal)?.toString() || officialSources[0].url;
  const fundingSupported = Boolean(raw.fundingEvidence && officialSources.length);
  const status = deadlineStatus(raw);
  return {
    id: `live-${raw.schemeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)}`, name: raw.schemeName, agency: raw.agency, ministry: raw.ministry ?? "Not stated on the official source", sourceType: "LIVE", programmeType: raw.programmeType as ProgrammeType, supportType: raw.supportType,
    fundingLabel: fundingSupported ? raw.fundingLabel : "Not stated on the official source", maximumDirectGrantInr: fundingSupported ? raw.maximumDirectGrantInr : null, maximumOtherSupportInr: null, fundingInstrument: raw.programmeType.replaceAll("_", " ").toLowerCase(), summary: raw.matchReason,
    eligibilityRequirements: raw.eligibilityRequirements, hardRequirements: [], preferredDomains: raw.supportedDomains as InventionDomain[], preferredStages: raw.supportedStages, supportedApplicantTypes: [], whatItSupports: raw.supportType, applicationMethod: raw.applicationMethod, applicationSteps: raw.applicationSteps,
    commonlyRequestedDocuments: [], officialPortal: portal, officialSources, ...status, difficulty: "MEDIUM", lastReviewed: checkedAt, evidence: { funding: raw.fundingEvidence, eligibility: raw.eligibilityEvidence, activeStatus: raw.activeStatusEvidence, deadline: raw.deadlineEvidence }, confidence: raw.confidence, verificationWarnings: raw.verificationWarnings,
  };
}

export async function discoverOfficialSchemes(prompt: string) {
  if (!process.env.OPENAI_API_KEY) throw new GrantWebSearchError("Live official discovery is not configured.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await openai.responses.parse({ model: process.env.OPENAI_MODEL || "gpt-5-mini", store: false, instructions: INSTRUCTIONS, input: prompt, tools: [{ type: "web_search", search_context_size: "medium", filters: { allowed_domains: OFFICIAL_DOMAINS }, user_location: { type: "approximate", country: "IN", timezone: "Asia/Kolkata" } }], tool_choice: "required", include: ["web_search_call.action.sources"], text: { format: zodTextFormat(liveResultSchema, "government_schemes") } }, { signal: controller.signal });
    const parsed = liveResultSchema.safeParse(response.output_parsed);
    if (!parsed.success) throw new GrantWebSearchError("Official discovery returned an invalid response.");
    const checkedAt = new Date().toISOString();
    return { schemes: parsed.data.schemes.map((item) => normalizeLiveScheme(item, checkedAt)).filter((item): item is GovernmentScheme => Boolean(item)), checkedAt };
  } catch (error) {
    if (error instanceof GrantWebSearchError) throw error;
    console.error("[grant-search] Live official discovery failed", { name: error instanceof Error ? error.name : "UnknownError", status: typeof error === "object" && error && "status" in error ? (error as { status?: unknown }).status : undefined });
    throw new GrantWebSearchError("Live official discovery could not be completed right now.");
  } finally { clearTimeout(timer); }
}
