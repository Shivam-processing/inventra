import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { classifyInvention } from "./classifier";
import { CURATED_GOVERNMENT_SCHEMES } from "./curated-schemes";
import { isOfficialGovernmentUrl } from "./domain-validator";
import { filterGrantMatches } from "./filters";
import { createGrantInputHash } from "./input-hash";
import { directGrantSummary, rankSchemes, recalculateCuratedForApplicant, sumDirectGrantCeilings, summarizeMatches, topGrantMatches } from "./matcher";
import { mergeCuratedAndLive, normalizeSchemeName } from "./normalizer";
import { buildGrantSearchPrompt } from "./query";
import type { ApplicantProfile, GovernmentScheme, InventionGrantContext } from "./types";

const pillBox: InventionGrantContext = {
  title: "Offline Smart Pill Box with Single-Dose Compartment Unlocking",
  problemStatement: "Elderly patients can miss scheduled medicine doses.",
  proposedSolution: "A physical electronic pill box independently unlocks one medication compartment, gives visual and audible reminders, detects opening, and records a missed dose offline.",
  noveltyDescription: "Single-dose compartment access without a network connection.",
  technicalField: "Medication adherence device",
  approvedFeatures: ["Scheduled unlocking of independently lockable medicine compartments", "Offline missed-dose recording"],
  developmentStage: "concept",
  clarificationAnswers: [],
};
const applicant: ApplicantProfile = { applicantType: "individual", developmentStatus: "idea", dpiitRecognised: "not_sure", udyamRegistered: "not_sure", incorporated: "no", incorporatedUnderTwoYears: "not_sure", hasPrototype: "no", hasRevenue: "no", state: "", supportTypes: ["prototype", "incubation", "ip"] };

describe("grant domain classification", () => {
  it("classifies a smart pill box without inferring biotechnology or IoT", () => {
    const result = classifyInvention(pillBox);
    for (const domain of ["MEDTECH", "HEALTHCARE", "HARDWARE", "ELECTRONICS", "SOCIAL_IMPACT"] as const) assert.equal(result.domains.includes(domain), true);
    assert.equal(result.domains.includes("BIOTECH"), false);
    assert.equal(result.domains.includes("IOT"), false);
  });
  it("requires connected or network evidence for IoT", () => {
    assert.equal(classifyInvention({ ...pillBox, title: "Connected pill box", proposedSolution: "A networked remote monitoring device" }).domains.includes("IOT"), true);
  });
  it("does not create strong domains from generic words", () => {
    assert.deepEqual(classifyInvention({ ...pillBox, title: "A system", problemStatement: "A user needs a function", proposedSolution: "A device component", noveltyDescription: "", technicalField: "", approvedFeatures: [] }).domains, ["GENERAL_INNOVATION"]);
  });
});

describe("curated grant matching", () => {
  const detected = classifyInvention(pillBox);
  const matches = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, applicant, "2026-07-26T00:00:00.000Z");
  const byId = (id: string) => matches.find((item) => item.scheme.id === id)!;
  it("ranks NIDHI-PRAYAS strongly for concept-stage hardware", () => assert.equal(byId("nidhi-prayas").matchLevel, "HIGH"));
  it("requires applicant verification for NIDHI-PRAYAS without changing invention match", () => { assert.equal(byId("nidhi-prayas").matchLevel, "HIGH"); assert.equal(byId("nidhi-prayas").eligibilityStatus, "CHECK_REQUIREMENTS"); assert.match(byId("nidhi-prayas").missingRequirements.join(" "), /participating PRAYAS centre/i); });
  it("ranks NIDHI-PRAYAS above generic incubation for concept-stage hardware", () => assert.equal(byId("nidhi-prayas").score > byId("atal-incubation").score, true));
  it("does not allow broad domain overlap to saturate at 100", () => { const broad = classifyInvention({ ...pillBox, title: "Hardware software system", problemStatement: "", proposedSolution: "Electronic hardware and software", noveltyDescription: "", technicalField: "", approvedFeatures: [] }); const result = rankSchemes(CURATED_GOVERNMENT_SCHEMES, broad, { ...applicant, supportTypes: ["any"] }); assert.equal(Math.max(...result.map((item) => item.score)) < 100, true); });
  it("keeps technical invention score independent from applicant completeness", () => { const incomplete = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "not_sure", dpiitRecognised: "not_sure", udyamRegistered: "not_sure", incorporated: "not_sure", incorporatedUnderTwoYears: "not_sure", hasPrototype: "not_sure" }); assert.equal(incomplete.find((item) => item.scheme.id === "nidhi-prayas")?.score, byId("nidhi-prayas").score); assert.notEqual(incomplete.find((item) => item.scheme.id === "nidhi-prayas")?.eligibilityScore, undefined); });
  it("never marks an incomplete applicant profile likely eligible", () => { const incomplete = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "not_sure", developmentStatus: "not_sure", dpiitRecognised: "not_sure", udyamRegistered: "not_sure", incorporated: "not_sure", incorporatedUnderTwoYears: "not_sure", hasPrototype: "not_sure" }); assert.equal(incomplete.some((item) => item.eligibilityStatus === "LIKELY_ELIGIBLE"), false); });
  it("keeps unresolved hard requirements in applicant eligibility", () => { const sisfs = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "dpiit_startup", dpiitRecognised: "yes", incorporatedUnderTwoYears: "not_sure" }).find((item) => item.scheme.id === "sisfs"); assert.ok(sisfs); assert.equal(sisfs.eligibilityStatus, "CHECK_REQUIREMENTS"); assert.equal(sisfs.eligibilityScore < 100, true); });
  it("does not call SISFS likely eligible without DPIIT evidence", () => assert.notEqual(byId("sisfs").eligibilityStatus, "LIKELY_ELIGIBLE"));
  it("keeps SISFS grant and other support separate", () => { assert.equal(byId("sisfs").scheme.maximumDirectGrantInr, 2_000_000); assert.equal(byId("sisfs").scheme.maximumOtherSupportInr, 5_000_000); });
  it("does not highly rank ordinary electronic medtech for BIG", () => { assert.equal(byId("birac-big").matchLevel, "EXPLORE"); assert.equal(byId("birac-big").eligibilityStatus, "LIKELY_NOT_ELIGIBLE"); });
  it("classifies CGTMSE and Fund of Funds instruments correctly", () => { assert.equal(byId("cgtmse").scheme.programmeType, "CREDIT_GUARANTEE"); assert.equal(byId("fund-of-funds").scheme.programmeType, "INDIRECT_INVESTMENT"); });
  it("excludes loans, guarantees and indirect investment from direct-grant totals", () => { const total = sumDirectGrantCeilings([byId("sisfs"), byId("cgtmse"), byId("fund-of-funds")]); assert.equal(total, 2_000_000); });
  it("applies hard requirements to eligibility without changing invention relevance", () => { const eligible = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "dpiit_startup", dpiitRecognised: "yes", incorporatedUnderTwoYears: "yes" }).find((item) => item.scheme.id === "sisfs"); const denied = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "dpiit_startup", dpiitRecognised: "no", incorporatedUnderTwoYears: "yes" }).find((item) => item.scheme.id === "sisfs"); assert.ok(eligible && denied); assert.equal(denied.score, eligible.score); assert.ok(denied.eligibilityScore < eligible.eligibilityScore); });
  it("marks a confirmed failed hard requirement likely not eligible", () => { const denied = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "dpiit_startup", dpiitRecognised: "no", incorporatedUnderTwoYears: "yes" }).find((item) => item.scheme.id === "sisfs"); assert.equal(denied?.eligibilityStatus, "LIKELY_NOT_ELIGIBLE"); });
  it("keeps invention relevance and applicant eligibility separate", () => { const conditional = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "dpiit_startup", dpiitRecognised: "yes", incorporatedUnderTwoYears: "not_sure" }).find((item) => item.scheme.id === "sisfs"); assert.ok(conditional); assert.equal(typeof conditional.score, "number"); assert.equal(conditional.eligibilityStatus, "CHECK_REQUIREMENTS"); });
  it("changes SISFS eligibility when DPIIT and incorporation evidence changes", () => { const unknown = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "not_sure", dpiitRecognised: "not_sure", incorporated: "not_sure", incorporatedUnderTwoYears: "not_sure" }).find((item) => item.scheme.id === "sisfs"); const confirmed = rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, { ...applicant, applicantType: "dpiit_startup", dpiitRecognised: "yes", incorporated: "yes", incorporatedUnderTwoYears: "yes" }).find((item) => item.scheme.id === "sisfs"); assert.ok(unknown && confirmed); assert.notEqual(unknown.eligibilityStatus, confirmed.eligibilityStatus); assert.equal(unknown.score, confirmed.score); });
  it("requires NIDHI-EIR applicant and programme-condition verification", () => { const eir = byId("nidhi-eir"); assert.equal(eir.eligibilityStatus, "CHECK_REQUIREMENTS"); assert.match(eir.missingRequirements.join(" "), /education|full-time entrepreneurship/i); });
  it("requires startup and eligible-incubator verification for NIDHI Seed Support", () => { const seed = byId("nidhi-ssp"); assert.equal(seed.eligibilityStatus, "CHECK_REQUIREMENTS"); assert.match(seed.missingRequirements.join(" "), /startup status/i); assert.match(seed.missingRequirements.join(" "), /eligible NIDHI incubator/i); });
  it("has stable deterministic ordering", () => assert.deepEqual(rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, applicant).map((item) => item.scheme.id), rankSchemes(CURATED_GOVERNMENT_SCHEMES, detected, applicant).map((item) => item.scheme.id)));
  it("keeps deterministic top-three ordering", () => assert.deepEqual(topGrantMatches(matches).map((item) => item.scheme.id), matches.slice(0, 3).map((item) => item.scheme.id)));
  it("excludes IP support, guarantees, and fellowships from direct-grant ceilings", () => { const fakeFellowship = { ...byId("nidhi-eir"), scheme: { ...byId("nidhi-eir").scheme, maximumDirectGrantInr: 999_999, evidence: { funding: "Fellowship amount" } } }; const result = directGrantSummary([byId("sisfs"), byId("patent-fee"), byId("cgtmse"), fakeFellowship]); assert.equal(result.total, 2_000_000); assert.equal(result.programmes, 1); });
  it("counts unique schemes in summaries", () => { const summary = summarizeMatches([byId("sisfs"), byId("sisfs")]); assert.equal(summary.directGrants, 1); });
});

describe("official source validation and live normalization", () => {
  it("accepts government and allowlisted official hosts", () => { assert.equal(isOfficialGovernmentUrl("https://example.gov.in/scheme"), true); assert.equal(isOfficialGovernmentUrl("https://nidhi.dst.gov.in/"), true); assert.equal(isOfficialGovernmentUrl("https://www.cgtmse.in/"), true); });
  it("rejects unofficial domains and URL shorteners", () => { assert.equal(isOfficialGovernmentUrl("https://grants-blog.example/scheme"), false); assert.equal(isOfficialGovernmentUrl("https://bit.ly/example"), false); });
  it("normalizes known aliases", () => { assert.equal(normalizeSchemeName("SISFS"), "startup india seed fund scheme"); assert.equal(normalizeSchemeName("Startup India Seed Fund Scheme (SISFS)"), "startup india seed fund scheme"); });
  it("merges a duplicate live scheme into its curated identity and retains sources", () => {
    const base = rankSchemes(CURATED_GOVERNMENT_SCHEMES, classifyInvention(pillBox), applicant);
    const curated = base.filter((item) => item.scheme.id === "sisfs");
    const liveScheme: GovernmentScheme = { ...curated[0].scheme, id: "live-sisfs", name: "SISFS", sourceType: "LIVE", officialSources: [{ title: "Current SISFS", url: "https://seedfund.startupindia.gov.in/", hostname: "seedfund.startupindia.gov.in", checkedAt: "2026-07-26" }] };
    const live = rankSchemes([liveScheme], classifyInvention(pillBox), applicant);
    const merged = mergeCuratedAndLive(curated, live);
    assert.equal(merged.curated[0].scheme.sourceType, "CURATED_LIVE"); assert.equal(merged.live.length, 0); assert.equal(merged.curated[0].scheme.officialSources.length >= 2, true);
  });
});

describe("grant UI logic and privacy", () => {
  const matches = rankSchemes(CURATED_GOVERNMENT_SCHEMES, classifyInvention(pillBox), applicant);
  it("filters and clears deterministically", () => { assert.equal(filterGrantMatches(matches, "direct").every((item) => ["DIRECT_GRANT", "RESEARCH_GRANT"].includes(item.scheme.programmeType)), true); assert.equal(filterGrantMatches(matches, "all").length, matches.length); });
  it("filters eligibility independently from invention match", () => { assert.equal(filterGrantMatches(matches, "likely").every((item) => item.eligibilityStatus === "LIKELY_ELIGIBLE"), true); assert.equal(filterGrantMatches(matches, "explore").every((item) => item.matchLevel === "EXPLORE"), true); });
  it("requires official active-window evidence for the open filter", () => { const open = { ...matches[0], scheme: { ...matches[0].scheme, currentlyOpenStatus: "VERIFIED_OPEN" as const } }; assert.deepEqual(filterGrantMatches([matches[0], open], "open"), [open]); });
  it("summarizes instruments separately", () => { const summary = summarizeMatches(matches); assert.equal(summary.directGrants > 0, true); assert.equal(summary.loansGuarantees > 0, true); assert.equal(summary.incubationFellowships > 0, true); });
  it("builds a concise prompt without private identifiers", () => { const prompt = buildGrantSearchPrompt(pillBox, applicant); assert.equal(prompt.includes("user@example.com"), false); assert.equal(prompt.includes("123e4567-e89b-12d3-a456-426614174000"), false); assert.equal(prompt.includes("storage_path"), false); assert.equal(prompt.includes(pillBox.title), true); });
  it("clears stale live sections when applicant information changes", () => { const original = { curated: matches, live: [matches[0]], needsVerification: [matches[1]], detectedProfile: classifyInvention(pillBox), liveEnabled: true, liveCheckedAt: "2026-07-26T10:00:00.000Z", notice: null, inputHash: "old", profileMatchedAt: "2026-07-26T10:00:00.000Z" }; const refreshed = recalculateCuratedForApplicant(original, { ...applicant, dpiitRecognised: "yes" }); assert.equal(refreshed.live.length, 0); assert.equal(refreshed.needsVerification.length, 0); assert.equal(refreshed.liveCheckedAt, null); assert.equal(refreshed.curated.length > 0, true); });
  it("hashes every applicant and invention input so stale results cannot match", () => { const original = createGrantInputHash(applicant, pillBox); assert.notEqual(original, createGrantInputHash({ ...applicant, dpiitRecognised: "yes" }, pillBox)); assert.notEqual(original, createGrantInputHash({ ...applicant, state: "Karnataka" }, pillBox)); assert.notEqual(original, createGrantInputHash(applicant, { ...pillBox, title: "Updated invention" })); });
  it("marks old client results outdated instead of recalculating them", () => { const source = readFileSync(new URL("../../components/grant-finder.tsx", import.meta.url), "utf8"); assert.match(source, /setResultOutdated\(true\)/); assert.doesNotMatch(source, /setResult\(\{ \.\.\.recalculateCuratedForApplicant/); });
  it("keeps curated and live results in separate sections", () => { const result = { curated: matches.slice(0, 2), live: matches.slice(2, 3), needsVerification: matches.slice(3, 4) }; assert.equal(result.curated.some((item) => result.live.includes(item)), false); assert.equal(result.live.some((item) => result.needsVerification.includes(item)), false); });
});
