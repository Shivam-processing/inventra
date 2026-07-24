import "server-only";

import type {
  PatentDraftInput,
  PatentDraftSections,
} from "@/lib/patents/patent-draft-types";

export const MOCK_PATENT_DRAFT_PROVIDER = {
  name: "MockPatentDraftProvider",
  version: "1.0.0",
} as const;

function numbered(values: string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function overlapNotes(input: PatentDraftInput): string {
  if (!input.overlapMatches.length) {
    return "The stored overlap report contains insufficient comparison information and requires further review.";
  }

  return input.overlapMatches.map((match) => {
    const patent = match.matchedPatentTitle && match.publicationNumber
      ? ` in ${match.matchedPatentTitle} (${match.publicationNumber})`
      : " in the searched patent records";

    switch (match.matchType) {
      case "FULL":
        return `Similar functionality was identified for the approved feature “${match.feature}”${patent}.`;
      case "PARTIAL":
        return `Partial textual overlap was identified for “${match.feature}”${patent}; any differentiation requires careful review.`;
      case "UNCERTAIN":
        return `The comparison for “${match.feature}” is uncertain and further review is required.`;
      case "NOT_FOUND":
        return `No keyword match was found for “${match.feature}” in the searched records; this does not establish legal novelty.`;
    }
  }).join("\n");
}

function preliminaryClaims(input: PatentDraftInput): string {
  const dependentFeatures = input.approvedFeatures.length
    ? input.approvedFeatures
    : ["No approved feature wording is available"];

  const independent = `1. A preliminary system or apparatus for addressing the stored problem statement, the system or apparatus being configured only as described in the stored invention disclosure: ${input.description}`;
  const dependent = dependentFeatures.map((feature, index) =>
    `${index + 2}. The preliminary system or apparatus of claim 1, wherein the approved feature is: ${feature}`,
  );

  return [
    "Preliminary, non-legal claim wording for review:",
    independent,
    ...dependent,
  ].join("\n\n");
}

function disclosureHistory(input: PatentDraftInput): string {
  const facts = [
    `Publicly disclosed: ${input.publiclyDisclosed ? "Yes" : "No"}.`,
    `Previously sold: ${input.previouslySold ? "Yes" : "No"}.`,
    `Previously filed: ${input.previouslyFiled ? "Yes" : "No"}.`,
  ];
  return facts.join(" ");
}

export class MockPatentDraftProvider {
  async generate(input: PatentDraftInput): Promise<PatentDraftSections> {
    const technicalField = input.technicalField.trim()
      ? input.technicalField.trim()
      : "The technical field is not specified in the approved stored information.";
    const patentReferences = input.patentResults.length
      ? input.patentResults.slice(0, 5).map((patent) => `${patent.title} (${patent.publicationNumber})`).join("; ")
      : "No patent result records were available in the completed search.";
    const featureText = numbered(input.approvedFeatures);

    return {
      title: input.title,
      technicalField: `The disclosure relates to ${technicalField}.`,
      background: [
        input.problemStatement,
        `The completed patent search returned ${input.patentResults.length} stored result${input.patentResults.length === 1 ? "" : "s"}. References reviewed: ${patentReferences}`,
        `The preliminary overlap classification is ${input.overlapSummary.classification.replaceAll("_", " ").toLowerCase()}.`,
        overlapNotes(input),
        disclosureHistory(input),
      ].join("\n\n"),
      problemStatement: input.problemStatement,
      summaryOfInvention: `The stored invention disclosure describes the following approach:\n\n${input.description}\n\nApproved features:\n${featureText}`,
      detailedDescription: `${input.description}\n\nThe approved feature set is limited to:\n${featureText}\n\nNo additional components, measurements, materials, integrations, or implementation details are inferred in this preliminary draft.`,
      essentialFeatures: featureText,
      exampleImplementation: `A preliminary example, limited to the stored invention disclosure, is as follows:\n\n${input.description}\n\nDevelopment stage recorded by the user: ${input.developmentStage}. No unstated implementation details are added.`,
      preliminaryClaims: preliminaryClaims(input),
      abstract: `${input.title}. ${input.problemStatement} The stored disclosure describes: ${input.description} Approved features: ${input.approvedFeatures.join("; ")}.`,
    };
  }
}
