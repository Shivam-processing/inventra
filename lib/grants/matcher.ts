import { CURATED_GOVERNMENT_SCHEMES, isDirectGrant } from "./curated-schemes";
import { normalizeSchemeName } from "./normalizer";
import type { ApplicantProfile, ClassifiedProfile, GovernmentScheme, GrantMatch, GrantSearchResult } from "./types";

const BROAD_DOMAINS = new Set(["GENERAL_INNOVATION", "HARDWARE", "ELECTRONICS", "SOFTWARE", "HEALTHCARE"]);
type ImportantProfileField = "applicantType" | "dpiitRecognised" | "udyamRegistered" | "incorporated" | "incorporatedUnderTwoYears" | "hasPrototype";
const IMPORTANT_PROFILE_FIELDS: ImportantProfileField[] = ["applicantType", "dpiitRecognised", "udyamRegistered", "incorporated", "incorporatedUnderTwoYears", "hasPrototype"];

function applicantKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function hardRequirementStatus(requirement: string, profile: ApplicantProfile, domains: string[]) {
  if (requirement === "dpiit_yes") return profile.dpiitRecognised;
  if (requirement === "incorporated_under_two_years_yes") return profile.incorporatedUnderTwoYears;
  if (requirement === "biotech_domain") return domains.includes("BIOTECH") ? "yes" : "no";
  return "not_sure";
}

export function applicantProfileCompleteness(profile: ApplicantProfile) {
  const completed = IMPORTANT_PROFILE_FIELDS.filter((key) => profile[key] !== "not_sure" && profile[key] !== "").length;
  return { completed, total: IMPORTANT_PROFILE_FIELDS.length, missing: IMPORTANT_PROFILE_FIELDS.filter((key) => profile[key] === "not_sure" || profile[key] === "") };
}

function applicantMismatch(scheme: GovernmentScheme, applicantType: string) {
  if (applicantType === "not_sure") return false;
  if (scheme.supportedApplicantTypes.length === 0) return false;
  if (scheme.supportedApplicantTypes.includes(applicantType)) return false;
  return !(["student", "researcher"].includes(applicantType) && scheme.supportedApplicantTypes.includes("individual"));
}

function extraUnknownRequirements(scheme: GovernmentScheme, profile: ApplicantProfile) {
  const missing: string[] = [];
  if (profile.applicantType === "not_sure") missing.push("Applicant type");
  if (profile.developmentStatus === "not_sure" && scheme.preferredStages.length > 0) missing.push("Development-stage suitability");
  if (scheme.supportType.includes("prototype") && profile.hasPrototype === "not_sure") missing.push("Current prototype status");
  if (scheme.programmeType === "CREDIT_GUARANTEE" && profile.udyamRegistered === "not_sure") missing.push("Udyam or qualifying enterprise status");
  if (["DIRECT_GRANT", "INDIRECT_INVESTMENT"].includes(scheme.programmeType) && scheme.supportedApplicantTypes.some((item) => item.includes("startup")) && profile.incorporated === "not_sure") missing.push("Incorporation status");
  if (scheme.programmeType === "FELLOWSHIP" && profile.applicantType === "not_sure") missing.push("Individual, founder, student or researcher status");
  if (scheme.id === "nidhi-prayas") missing.push("Applicant eligibility through a participating PRAYAS centre");
  if (scheme.id === "atal-incubation") missing.push("Selected Atal Incubation Centre intake and applicant category");
  if (scheme.id === "nidhi-eir") missing.push("Education or programme-specific criteria and full-time entrepreneurship conditions");
  if (scheme.id === "nidhi-ssp") {
    if (!["dpiit_startup", "startup_without_dpiit"].includes(profile.applicantType)) missing.push("Qualifying startup status");
    missing.push("Association with or application through an eligible NIDHI incubator");
  }
  return [...new Set(missing)];
}

function schemeReason(scheme: GovernmentScheme, detected: ClassifiedProfile, stage: string) {
  const physical = detected.domains.includes("HARDWARE") || detected.domains.includes("ELECTRONICS");
  const medical = detected.domains.includes("MEDTECH") || detected.domains.includes("HEALTHCARE");
  if (scheme.id === "nidhi-prayas") return `NIDHI-PRAYAS aligns with the need to build and validate ${medical && physical ? "a physical medicine-management prototype" : physical ? "a physical technology prototype" : "an early proof of concept"}.`;
  if (scheme.id === "sisfs") return "This programme supports early product development and commercialisation, but requires a qualifying DPIIT-recognised startup and confirmation of startup age.";
  if (scheme.id === "sipp" || scheme.id === "patent-fee") return "This IP-support programme may reduce filing-related costs or provide facilitation, but it does not fund prototype development.";
  if (scheme.id === "cgtmse") return "CGTMSE may improve access to lender credit for a qualifying micro or small enterprise; it is a credit guarantee, not a grant.";
  if (scheme.id === "birac-big") return detected.domains.includes("BIOTECH") ? "BIG may support the invention's biotechnology proof-of-concept work." : "BIG requires substantive biotechnology evidence, which was not detected in this invention.";
  if (scheme.id === "birac-sparsh") return medical ? "SPARSH may fit the invention's health and social-impact problem, subject to the scope of a current fellowship call." : "SPARSH requires a relevant health, biotechnology or social-impact programme theme.";
  if (scheme.programmeType === "INCUBATION_SUPPORT") return `This incubation programme may provide mentoring and facilities for the invention's ${stage.replaceAll("_", " ")} stage, but support varies by centre.`;
  if (scheme.programmeType === "FELLOWSHIP") return "This fellowship may support an individual founder developing the invention, subject to founder status and an active programme call.";
  return scheme.preferredDomains.some((domain) => detected.domains.includes(domain)) ? `${scheme.name} has a relevant technical or commercialisation pathway for the detected invention profile.` : `${scheme.name} is a secondary option with limited direct technical alignment.`;
}

function nextActionForScheme(scheme: GovernmentScheme, missing: string[], unmet: string[]) {
  if (unmet.length) return `Resolve the confirmed mismatch before applying: ${unmet[0]}.`;
  if (missing.length) return `Confirm ${missing[0].toLowerCase()} on the official programme guidance.`;
  if (scheme.id === "nidhi-prayas") return "Identify a participating PRAYAS centre and review its current prototype call.";
  if (scheme.programmeType === "CREDIT_GUARANTEE") return "Confirm enterprise eligibility, then approach a participating lender.";
  if (scheme.programmeType === "IP_SUPPORT") return "Check the current applicant category and use an official empanelled facilitator where applicable.";
  if (scheme.programmeType === "INCUBATION_SUPPORT") return "Choose a centre aligned with the invention and check its current intake.";
  return `Review the current application route on the ${scheme.agency} official portal.`;
}

export function matchScheme(scheme: GovernmentScheme, detected: ClassifiedProfile, applicant: ApplicantProfile, checkedAt = new Date().toISOString()): GrantMatch {
  const matchedDomains = scheme.preferredDomains.filter((domain) => detected.domains.includes(domain));
  const stage = detected.stage;
  const matchedStages = scheme.preferredStages.includes(stage) ? [stage] : [];
  const applicantType = applicantKey(applicant.applicantType);
  const applicantFit = !applicantMismatch(scheme, applicantType);
  const supportFit = applicant.supportTypes.includes("any") || applicant.supportTypes.some((type) => scheme.supportType.includes(type));
  const hardStatuses = scheme.hardRequirements.map((item) => ({ item, status: hardRequirementStatus(item, applicant, detected.domains) }));
  const hardFailed = hardStatuses.filter(({ status }) => status === "no");
  const hardUnknown = hardStatuses.filter(({ status }) => status === "not_sure");
  const preciseMatches = matchedDomains.filter((domain) => !BROAD_DOMAINS.has(domain));
  const broadOnly = matchedDomains.length > 0 && preciseMatches.length === 0;
  const domainScore = preciseMatches.length ? Math.min(25, 15 + (preciseMatches.length - 1) * 5 + Math.min(5, matchedDomains.length - preciseMatches.length)) : matchedDomains.length ? Math.min(12, 6 + matchedDomains.length * 2) : 0;
  const stageScore = matchedStages.length ? 20 : 5;
  let score = Math.round((domainScore + stageScore) / 45 * 100);
  if (scheme.id === "nidhi-prayas" && matchedDomains.includes("HARDWARE") && ["idea", "proof_of_concept", "prototype"].includes(stage)) score = Math.max(score, 92);
  if (scheme.programmeType === "INCUBATION_SUPPORT" && scheme.currentlyOpenStatus !== "VERIFIED_OPEN") score = Math.min(score, 84);
  if (scheme.programmeType === "FELLOWSHIP" && scheme.currentlyOpenStatus !== "VERIFIED_OPEN") score = Math.min(score, 79);
  if (scheme.programmeType === "IP_SUPPORT") score = Math.min(score, 69);
  if (scheme.programmeType === "COMPETITION" && scheme.currentlyOpenStatus !== "VERIFIED_OPEN") score = Math.min(score, 74);
  if (scheme.id === "birac-big" && !detected.domains.includes("BIOTECH")) score = Math.min(score, 24);
  if (broadOnly) score = Math.min(score, 49);
  if (score > 90 && (domainScore < 20 || stageScore < 20)) score = 90;
  const matchLevel = score >= 75 ? "HIGH" : score >= 50 ? "MODERATE" : "EXPLORE";
  const additionalUnknown = extraUnknownRequirements(scheme, applicant);
  const missingRequirements = [...hardUnknown.map(({ item }) => item === "dpiit_yes" ? "DPIIT recognition status" : item === "incorporated_under_two_years_yes" ? "Whether the startup was incorporated within the programme age limit" : "Evidence of substantive biotechnology innovation"), ...additionalUnknown];
  const likelyUnmetRequirements = [...hardFailed.map(({ item }) => item === "dpiit_yes" ? "DPIIT recognition is currently marked No" : item === "incorporated_under_two_years_yes" ? "Startup age appears outside the stated limit" : "No substantive biotechnology evidence was detected"), ...(applicantMismatch(scheme, applicantType) ? [`The confirmed applicant type is not listed for ${scheme.name}`] : [])];
  const completeness = applicantProfileCompleteness(applicant);
  const mostlyIncomplete = completeness.completed <= 1;
  const eligibilityStatus = likelyUnmetRequirements.length ? "LIKELY_NOT_ELIGIBLE" : mostlyIncomplete ? "INSUFFICIENT_INFORMATION" : missingRequirements.length ? "CHECK_REQUIREMENTS" : applicant.applicantType !== "not_sure" && applicantFit && hardUnknown.length === 0 && hardFailed.length === 0 ? "LIKELY_ELIGIBLE" : "CHECK_REQUIREMENTS";
  const matchedApplicantFactors = [applicantFit ? applicant.applicantType : "", supportFit ? `Requested support: ${applicant.supportTypes.join(", ")}` : ""].filter(Boolean);
  const likelySatisfiedRequirements = [matchedDomains.length ? `Domain fit: ${matchedDomains.join(", ")}` : "", matchedStages.length ? `Stage fit: ${stage}` : ""].filter(Boolean);
  const reason = schemeReason(scheme, detected, stage);
  const eligibilityScore = likelyUnmetRequirements.length
    ? 10
    : Math.max(20, Math.min(100, Math.round(completeness.completed / completeness.total * 70) + (applicantFit ? 15 : 0) + (hardUnknown.length ? 0 : 15) - Math.min(30, missingRequirements.length * 5)));
  return { scheme, score, eligibilityScore, matchLevel, eligibilityStatus, matchedDomains, matchedStages, matchedApplicantFactors, missingRequirements, likelySatisfiedRequirements, likelyUnmetRequirements, reason, nextAction: nextActionForScheme(scheme, missingRequirements, likelyUnmetRequirements), citations: scheme.officialSources, checkedAt };
}

export function rankSchemes(schemes: GovernmentScheme[], detected: ClassifiedProfile, applicant: ApplicantProfile, checkedAt?: string) {
  return schemes.map((scheme) => matchScheme(scheme, detected, applicant, checkedAt)).sort((a, b) => (b.score + b.eligibilityScore * .25) - (a.score + a.eligibilityScore * .25) || b.score - a.score || b.matchedDomains.length - a.matchedDomains.length || a.scheme.programmeType.localeCompare(b.scheme.programmeType) || a.scheme.name.localeCompare(b.scheme.name));
}

export function sumDirectGrantCeilings(matches: GrantMatch[]) {
  return directGrantSummary(matches).total;
}

export function uniqueGrantMatches(matches: GrantMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => { const key = normalizeSchemeName(match.scheme.name); if (seen.has(key)) return false; seen.add(key); return true; });
}

export function directGrantSummary(matches: GrantMatch[]) {
  const contributors = uniqueGrantMatches(matches).filter((match) => isDirectGrant(match.scheme.programmeType) && typeof match.scheme.maximumDirectGrantInr === "number" && match.scheme.maximumDirectGrantInr > 0 && Boolean(match.scheme.evidence.funding));
  return { total: contributors.reduce((total, match) => total + (match.scheme.maximumDirectGrantInr ?? 0), 0), programmes: contributors.length };
}

export function topGrantMatches(matches: GrantMatch[], limit = 3) { return uniqueGrantMatches(matches).slice(0, limit); }

export function recalculateCuratedForApplicant(result: GrantSearchResult, applicant: ApplicantProfile): GrantSearchResult {
  return { ...result, curated: rankSchemes(CURATED_GOVERNMENT_SCHEMES, result.detectedProfile, applicant), live: [], needsVerification: [], liveCheckedAt: null };
}

export function summarizeMatches(matches: GrantMatch[]) {
  const unique = uniqueGrantMatches(matches);
  return {
    high: unique.filter((item) => item.matchLevel === "HIGH").length,
    directGrants: unique.filter((item) => isDirectGrant(item.scheme.programmeType)).length,
    loansGuarantees: unique.filter((item) => ["LOAN", "CREDIT_GUARANTEE", "INDIRECT_INVESTMENT"].includes(item.scheme.programmeType)).length,
    incubationFellowships: unique.filter((item) => ["INCUBATION_SUPPORT", "FELLOWSHIP"].includes(item.scheme.programmeType)).length,
    ipSupport: unique.filter((item) => item.scheme.programmeType === "IP_SUPPORT").length,
  };
}
