import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { GrantCard } from "@/components/grant-card";
import { LanguageProvider } from "@/components/language-provider";
import { classifyInvention } from "./classifier";
import { CURATED_GOVERNMENT_SCHEMES } from "./curated-schemes";
import { rankSchemes } from "./matcher";
import type { ApplicantProfile, InventionGrantContext } from "./types";

const invention: InventionGrantContext = { title: "Offline Smart Pill Box", problemStatement: "Patients miss medicine doses.", proposedSolution: "An electronic pill box unlocks a scheduled medicine compartment and gives an audible reminder.", noveltyDescription: "Offline single-dose compartment control.", technicalField: "Medication adherence device", approvedFeatures: ["Scheduled unlocking of a medicine compartment"], developmentStage: "concept", clarificationAnswers: [] };
const applicant: ApplicantProfile = { applicantType: "individual", developmentStatus: "idea", dpiitRecognised: "not_sure", udyamRegistered: "not_sure", incorporated: "no", incorporatedUnderTwoYears: "not_sure", hasPrototype: "no", hasRevenue: "no", state: "", supportTypes: ["prototype"] };

function renderPrayasCard() {
  const match = rankSchemes(CURATED_GOVERNMENT_SCHEMES, classifyInvention(invention), applicant).find((item) => item.scheme.id === "nidhi-prayas");
  assert.ok(match);
  return renderToStaticMarkup(<LanguageProvider locale="en"><GrantCard match={match} /></LanguageProvider>);
}

describe("government grant card", () => {
  it("renders labels and values as separate block elements", () => {
    const markup = renderPrayasCard();
    assert.match(markup, /class="grant-copy-label">Why it matches the invention<\/span><span class="grant-copy-value">/);
    assert.match(markup, /class="grant-copy-label">Important requirement<\/span><span class="grant-copy-value">/);
    assert.match(markup, /class="grant-copy-label">Best next action<\/span><span class="grant-copy-value">/);
    assert.match(markup, /class="grant-copy-label">Funding or support<\/span><span class="grant-funding-value">/);
    assert.doesNotMatch(markup, /INVENTIONNIDHI-PRAYAS/);
  });

  it("uses a concise applicant status while retaining the longer explanation", () => {
    const markup = renderPrayasCard();
    assert.match(markup, /<dd>Check requirements<\/dd>/);
    assert.match(markup, /class="grant-eligibility-explanation">Check requirements<\/p>/);
    assert.doesNotMatch(markup, /<dd>Likely eligible based on information provided<\/dd>/);
  });
});
