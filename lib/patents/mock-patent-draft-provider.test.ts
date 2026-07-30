import assert from "node:assert/strict";
import test from "node:test";
import { MockPatentDraftProvider, validatePreliminaryClaims } from "./mock-patent-draft-provider";
import type { PatentDraftInput } from "./patent-draft-types";

const input: PatentDraftInput = {
  title: "Offline Smart Pill Box with Single-Dose Compartment Unlocking",
  problemStatement: "Reminder-only pill boxes do not prevent access to an incorrect medicine compartment and may depend on internet connectivity.",
  description: "A standalone pill box uses a controller to check a stored schedule and unlock the assigned medicine compartment for the scheduled dose.",
  noveltyDescription: "Essential scheduling, selective access, reminders, opening checks, and missed-dose records operate offline.",
  clarificationAnswers: [{ question: "What happens at dose time?", answer: "The controller checks the stored schedule, unlocks the assigned compartment, and records a missed dose when opening is not detected within the allowed period." }],
  developmentStage: "prototype", publiclyDisclosed: false, previouslySold: false, previouslyFiled: false,
  technicalField: "Medical devices and healthcare technology",
  approvedFeatures: ["Independently lockable medicine compartments", "Scheduled compartment unlocking", "Visual reminder", "Audible reminder", "Compartment-opening detection", "Local missed-dose recording", "Offline operation"],
  patentResults: [{ title: "Old patent", publicationNumber: "EP1234567A1", priorityDate: null, publicationDate: null, applicant: null, abstract: null, sourceId: "source", sourceUrl: "" }],
  overlapSummary: { classification: "PARTIAL_OVERLAP", fullMatches: 0, partialMatches: 1, notFound: 0, uncertain: 0 },
  overlapMatches: [],
  figures: [{ figureNumber: 1, imageType: "PROTOTYPE", caption: "FIG. 1 illustrates an uploaded prototype view associated with the described invention." }],
};

test("generates a clean deterministic patent draft from stored disclosure data", async () => {
  const draft = await new MockPatentDraftProvider().generate(input);
  assert.match(draft.technicalField, /medication storage and dispensing/i);
  assert.doesNotMatch(draft.background, /EP1234567|FULL|PARTIAL|NOT_FOUND/);
  assert.match(draft.detailedDescription, /allowed period/);
  assert.match(draft.preliminaryClaims, /^1\. An apparatus comprising:/);
  assert.match(draft.preliminaryClaims, /2\. The apparatus of claim 1/);
  assert.doesNotMatch(draft.preliminaryClaims, /claim 2, further comprising or being configured/);
  assert.deepEqual(validatePreliminaryClaims(draft.preliminaryClaims), []);
  assert.doesNotMatch(draft.preliminaryClaims, /configured for at each/i);
  assert.doesNotMatch(draft.preliminaryClaims, /wherein the approved feature is/i);
  assert.match(draft.briefDescriptionOfDrawings, /^FIG\. 1/);
  assert.doesNotMatch(Object.values(draft).join(" "), /camera|mobile application|battery|cloud module/i);
  const abstractWords = draft.abstract.split(/\s+/).length;
  assert.ok(abstractWords >= 100 && abstractWords <= 180, `abstract contained ${abstractWords} words`);
  assert.match(draft.abstract, /[.!?]$/);
  assert.doesNotMatch(draft.abstract, /PARTIAL|EP1234567|Essential features:/);
});

test("shows the editor-only no-drawings state without inventing a figure", async () => {
  const draft = await new MockPatentDraftProvider().generate({ ...input, figures: [] });
  assert.equal(draft.briefDescriptionOfDrawings, "No drawings supplied");
});
