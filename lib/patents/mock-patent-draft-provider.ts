import type { PatentDraftInput, PatentDraftSections } from "@/lib/patents/patent-draft-types";
import { briefDescriptionOfDrawings } from "@/lib/patents/patent-draft-drawings";
import { uniqueSentences } from "@/lib/voice/transcript-review";

export const MOCK_PATENT_DRAFT_PROVIDER = { name: "MockPatentDraftProvider", version: "2.0.0" } as const;

function numbered(values: string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function sentence(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim().replace(/[;,]+$/, "");
  if (!cleaned) return "";
  return `${cleaned.replace(/^./, (letter) => letter.toLocaleUpperCase("en"))}${/[.!?]$/.test(cleaned) ? "" : "."}`;
}

function claimFeature(input: PatentDraftInput, pattern: RegExp): string | null {
  return input.approvedFeatures.find((feature) => pattern.test(feature.toLocaleLowerCase("en"))) ?? null;
}

export function validatePreliminaryClaims(value: string): string[] {
  const claims = value.split(/\n\s*\n/).map((claim) => claim.trim()).filter(Boolean);
  const errors: string[] = [];
  const numbers = new Set<number>();
  const normalizedTexts = new Set<string>();
  claims.forEach((claim, index) => {
    const match = claim.match(/^(\d+)\.\s+([\s\S]+)$/);
    if (!match) { errors.push(`Claim ${index + 1} is not numbered correctly.`); return; }
    const number = Number(match[1]);
    numbers.add(number);
    if (!/[.;]$/.test(claim)) errors.push(`Claim ${number} does not end with valid punctuation.`);
    const parent = claim.match(/\bclaim\s+(\d+)\b/i);
    if (parent && (!numbers.has(Number(parent[1])) || Number(parent[1]) >= number)) errors.push(`Claim ${number} references an invalid parent claim.`);
    const normalized = match[2].toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
    if (normalizedTexts.has(normalized)) errors.push(`Claim ${number} duplicates another claim.`);
    normalizedTexts.add(normalized);
    if (/configured for at each|approved feature|feature\s*\d+/i.test(claim)) errors.push(`Claim ${number} contains malformed feature wording.`);
  });
  if (!claims[0]?.startsWith("1. An apparatus comprising:")) errors.push("The independent apparatus claim is incomplete.");
  return errors;
}

function preliminaryClaims(input: PatentDraftInput): string {
  const featureText = input.approvedFeatures.join(" ").toLocaleLowerCase("en");
  const medicationCompartments = /(?:medicine|medication|pill).{0,30}compartment|compartment.{0,30}(?:medicine|medication|pill)/.test(featureText);
  const scheduledUnlocking = /schedul|dose time|predetermined time/.test(featureText) && /unlock|lock|access/.test(featureText);
  const controllerSupported = /controller/i.test([input.description, input.noveltyDescription, ...input.approvedFeatures, ...input.clarificationAnswers.map((item) => item.answer)].join(" "));
  if (medicationCompartments && scheduledUnlocking && controllerSupported) {
    const claims = [
      "1. An apparatus comprising:\nmultiple medicine compartments;\nrespective independently controllable locking mechanisms associated with the medicine compartments;\na stored medicine schedule; and\na controller configured to evaluate the stored medicine schedule and unlock only the medicine compartment associated with a scheduled dose.",
    ];
    if (claimFeature(input, /visual.*(?:reminder|alert|indicat)|(?:reminder|alert|indicat).*visual/)) claims.push("2. The apparatus of claim 1, wherein a visual indication is provided at a scheduled medicine time.");
    if (claimFeature(input, /audible|sound|audio/)) claims.push(`${claims.length + 1}. The apparatus of claim 1, wherein an audible indication is provided at the scheduled medicine time.`);
    if (claimFeature(input, /open(?:ing|ed)?\s+(?:detection|detect)|detect.{0,30}open/)) claims.push(`${claims.length + 1}. The apparatus of claim 1, wherein opening of the unlocked medicine compartment is detected.`);
    if (claimFeature(input, /missed.{0,20}(?:dose|record)|(?:dose|event).{0,20}record/)) claims.push(`${claims.length + 1}. The apparatus of claim 1, wherein a missed-dose event is stored when opening of the unlocked medicine compartment is not detected during an allowed period.`);
    if (claimFeature(input, /offline|without.{0,20}(?:internet|network|cloud)/)) claims.push(`${claims.length + 1}. The apparatus of claim 1, wherein essential schedule evaluation, selective unlocking, indication, opening detection, and missed-dose recording operate without internet or cloud connectivity.`);
    if (/local time|standalone power|battery|power source/i.test([input.description, input.noveltyDescription, ...input.approvedFeatures].join(" "))) claims.push(`${claims.length + 1}. The apparatus of claim 1, comprising the expressly described standalone power source or local timekeeping arrangement.`);
    const output = claims.join("\n\n");
    if (validatePreliminaryClaims(output).length) throw new Error("invalid_preliminary_claims");
    return output;
  }

  const independentFeatures = input.approvedFeatures.slice(0, 4).map((feature) => feature.replace(/[.;]+$/, ""));
  const independent = `1. An apparatus comprising:\n${independentFeatures.map((feature, index) => `${feature.replace(/^./, (letter) => letter.toLocaleLowerCase("en"))}${index === independentFeatures.length - 1 ? "." : ";"}`).join("\n")}`;
  const dependent = input.approvedFeatures.slice(4).map((feature, index) => `${index + 2}. The apparatus of claim 1, wherein ${feature.replace(/[.;]+$/, "").replace(/^./, (letter) => letter.toLocaleLowerCase("en"))}.`);
  const output = [independent, ...dependent].join("\n\n");
  if (validatePreliminaryClaims(output).length) throw new Error("invalid_preliminary_claims");
  return output;
}

function specificTechnicalField(input: PatentDraftInput): string {
  const stored = [input.title, input.description, input.noveltyDescription, ...input.approvedFeatures].join(" ").toLocaleLowerCase("en");
  if (/pill|medicine|medication|dose/.test(stored) && /box|container|compartment|dispenser|organiser|organizer/.test(stored)) {
    return "The disclosure relates to medication storage and dispensing devices, particularly schedule-controlled medicine containers with selectively accessible compartments.";
  }
  return input.technicalField.trim()
    ? `The disclosure relates to ${input.technicalField.trim()}.`
    : `The disclosure relates to the technical subject matter described as ${input.title}.`;
}

function clarificationText(input: PatentDraftInput): string {
  return input.clarificationAnswers.map(({ question, answer }) => `${question}\n${answer}`).join("\n\n");
}

function abstractText(input: PatentDraftInput): string {
  const featureSentences = input.approvedFeatures.map((feature) => sentence(`The described apparatus further provides ${feature.replace(/[.!?]+$/, "").replace(/^./, (letter) => letter.toLocaleLowerCase("en"))} as part of the stored technical disclosure`));
  const candidates = [
    sentence(`An apparatus is described for addressing ${input.problemStatement.replace(/[.!?]+$/, "")}`),
    sentence(input.noveltyDescription),
    ...featureSentences,
    ...input.clarificationAnswers.map((item) => sentence(item.answer)),
  ].filter(Boolean);
  const seen = new Set<string>();
  const unique = candidates.filter((item) => {
    const key = item.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const chosen: string[] = [];
  let words = 0;
  for (const item of unique) {
    const count = item.split(/\s+/).filter(Boolean).length;
    if (words >= 100 && words + count > 180) break;
    if (words + count <= 180) { chosen.push(item); words += count; }
  }
  return chosen.join(" ").trim();
}

export class MockPatentDraftProvider {
  async generate(input: PatentDraftInput): Promise<PatentDraftSections> {
    const cleanDescription = uniqueSentences(input.description) || input.description.trim();
    const featureText = numbered(input.approvedFeatures);
    const clarifications = clarificationText(input);
    const reminderLimitation = /reminder|alert|notification/i.test(`${input.problemStatement} ${input.description}`)
      ? "The stored information indicates that reminder-only approaches may notify a person without controlling access to the intended item or confirming the described action."
      : "";
    const connectivityLimitation = /offline|internet|network|cloud/i.test(`${input.problemStatement} ${input.description} ${input.noveltyDescription} ${clarifications}`)
      ? "The stored information also identifies continued essential operation without dependence on internet, network, or cloud connectivity."
      : "";

    return {
      title: input.title,
      technicalField: specificTechnicalField(input),
      background: [input.problemStatement, reminderLimitation, connectivityLimitation].filter(Boolean).join("\n\n"),
      problemStatement: input.problemStatement,
      summaryOfInvention: [cleanDescription, input.noveltyDescription, `Essential features:\n${featureText}`].filter(Boolean).join("\n\n"),
      detailedDescription: [cleanDescription, clarifications && `Stored clarification answers:\n${clarifications}`, `The described feature set is:\n${featureText}`, "No additional components, measurements, materials, integrations, or implementation details are inferred in this preliminary draft."].filter(Boolean).join("\n\n"),
      briefDescriptionOfDrawings: input.figures.length ? briefDescriptionOfDrawings(input.figures) : "No drawings supplied",
      essentialFeatures: featureText,
      exampleImplementation: `A preliminary example, limited to the stored invention disclosure, is as follows:\n\n${cleanDescription}\n\nDevelopment stage recorded by the user: ${input.developmentStage}. No unstated implementation details are added.`,
      preliminaryClaims: preliminaryClaims(input),
      abstract: abstractText(input),
    };
  }
}
