import type { ApplicantProfile, InventionGrantContext } from "./types";

export function buildGrantSearchPrompt(context: InventionGrantContext, profile: ApplicantProfile) {
  const payload = {
    invention: {
      title: context.title.slice(0, 300), problem: context.problemStatement.slice(0, 1500), solution: context.proposedSolution.slice(0, 2500), novelty: context.noveltyDescription.slice(0, 1200), technicalField: context.technicalField.slice(0, 300), approvedFeatures: context.approvedFeatures.slice(0, 10).map((item) => item.slice(0, 500)), developmentStage: context.developmentStage,
    },
    applicant: profile,
  };
  return `Search current official Indian government sources for grants, fellowships, incubation, credit support, IP support and commercialisation programmes relevant to this invention and applicant profile. Do not rely on memory. Return only programmes supported by official sources. Do not infer eligibility, amounts, deadlines, or open status without explicit official evidence.\n\n${JSON.stringify(payload)}`;
}

export function containsPrivateIdentifier(prompt: string, identifiers: string[]) {
  return identifiers.some((value) => value && prompt.includes(value));
}
