import { normalizeTrademarkName } from "./normalization";
import { trademarkConflictCandidateSchema, type TrademarkConflictCandidate } from "./types";

const explicitHosts = new Set(["ipindia.gov.in", "tmrsearch.ipindia.gov.in", "wipo.int", "www.wipo.int", "branddb.wipo.int", "euipo.europa.eu", "www.uspto.gov", "uspto.gov"]);
export function officialTrademarkSourceUrl(value: string) {
  try { const url = new URL(value); const host = url.hostname.toLowerCase(); if (url.protocol !== "https:" || (!explicitHosts.has(host) && !host.endsWith(".gov.in") && !host.endsWith(".nic.in"))) return null; return url; } catch { return null; }
}

export type DiscoveredOfficialRecord = { markName: string; niceClasses: number[]; goodsServices: string | null; ownerName: string | null; applicationOrRegistrationNumber: string | null; recordStatus: string | null; officialSourceUrl: string; sourceEvidence: string; checkedAt: string };
export function normalizeOfficialRecord(record: DiscoveredOfficialRecord, proposedName: string): TrademarkConflictCandidate {
  const source = officialTrademarkSourceUrl(record.officialSourceUrl); const complete = Boolean(source && record.markName.trim() && record.sourceEvidence.trim() && record.checkedAt && (record.niceClasses.length || record.goodsServices));
  const normalized = normalizeTrademarkName(record.markName); const exact = normalized.compactName === normalizeTrademarkName(proposedName).compactName;
  return trademarkConflictCandidateSchema.parse({ id: `official-${normalized.compactName}-${record.niceClasses.join("-") || "unknown"}`.slice(0, 100), markName: record.markName, normalizedMarkName: normalized.normalizedName, similarityTypes: exact ? ["IDENTICAL"] : ["VISUAL"], visualScore: exact ? 100 : 0, phoneticScore: exact ? 100 : 0, conceptualScore: 0, combinedSimilarityScore: exact ? 100 : 0, niceClasses: record.niceClasses, goodsServices: record.goodsServices, ownerName: complete ? record.ownerName : null, applicationOrRegistrationNumber: complete ? record.applicationOrRegistrationNumber : null, recordStatus: complete ? record.recordStatus : null, sourceType: source ? "OFFICIAL_REGISTRY" : "OFFICIAL_OFFICE_PAGE", officialSourceUrl: source?.toString() ?? null, sourceHostname: source?.hostname ?? null, sourceEvidence: record.sourceEvidence || null, checkedAt: record.checkedAt || null, verificationStatus: complete ? "VERIFIED_OFFICIAL" : "NEEDS_VERIFICATION", riskLevel: complete && exact ? "HIGH" : "UNDETERMINED", notes: complete ? "Supplementary official-source record; verify in the complete registry." : "Official evidence is incomplete and requires manual registry verification." });
}
