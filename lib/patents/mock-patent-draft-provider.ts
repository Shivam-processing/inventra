import type { PatentDraftInput, PatentDraftSections } from "@/lib/patents/patent-draft-types";

export const MOCK_PATENT_DRAFT_PROVIDER = { name: "MockPatentDraftProvider", version: "2.0.0" } as const;

function numbered(values: string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function preliminaryClaims(input: PatentDraftInput): string {
  const featureText = input.approvedFeatures.join(" ").toLocaleLowerCase("en");
  const medicationCompartments = /(?:medicine|medication|pill).{0,30}compartment|compartment.{0,30}(?:medicine|medication|pill)/.test(featureText);
  const scheduledUnlocking = /schedul|dose time|predetermined time/.test(featureText) && /unlock|lock|access/.test(featureText);
  const controllerSupported = /controller/i.test([input.description, input.noveltyDescription, ...input.approvedFeatures, ...input.clarificationAnswers.map((item) => item.answer)].join(" "));
  const independent = medicationCompartments && scheduledUnlocking && controllerSupported
    ? "1. An apparatus comprising:\nmultiple medicine compartments;\nrespective locking mechanisms associated with the medicine compartments; and\na controller associated with a stored medicine schedule, the controller being configured to unlock only a compartment associated with a scheduled dose."
    : `1. An apparatus comprising:\n${input.approvedFeatures.slice(0, 4).map((feature) => `${feature.replace(/[.;]+$/, "")};`).join("\n")}\nwherein the apparatus is limited to the recited technical features.`;
  const dependent = input.approvedFeatures.map((feature, index) =>
    `${index + 2}. The apparatus of claim ${index === 0 ? "1" : index + 1}, further comprising or being configured for ${feature.replace(/[.;]+$/, "").replace(/^./, (letter) => letter.toLocaleLowerCase("en"))}.`,
  );
  return [independent, ...dependent].join("\n\n");
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
  const source = [input.description, input.noveltyDescription, ...input.approvedFeatures].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return `${input.title}. ${source.split(" ").filter(Boolean).slice(0, 135).join(" ")}`.trim();
}

export class MockPatentDraftProvider {
  async generate(input: PatentDraftInput): Promise<PatentDraftSections> {
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
      summaryOfInvention: [input.description, input.noveltyDescription, `Essential features:\n${featureText}`].filter(Boolean).join("\n\n"),
      detailedDescription: [input.description, clarifications && `Stored clarification answers:\n${clarifications}`, `The described feature set is:\n${featureText}`, "No additional components, measurements, materials, integrations, or implementation details are inferred in this preliminary draft."].filter(Boolean).join("\n\n"),
      essentialFeatures: featureText,
      exampleImplementation: `A preliminary example, limited to the stored invention disclosure, is as follows:\n\n${input.description}\n\nDevelopment stage recorded by the user: ${input.developmentStage}. No unstated implementation details are added.`,
      preliminaryClaims: preliminaryClaims(input),
      abstract: abstractText(input),
    };
  }
}
