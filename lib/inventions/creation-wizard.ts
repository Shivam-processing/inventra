import { isSupportedVoiceLanguage } from "@/lib/voice/languages";

export const CREATION_WIZARD_STEPS = ["idea", "difference", "activity", "review"] as const;
export type CreationWizardStep = (typeof CREATION_WIZARD_STEPS)[number];

export type CreationWizardValues = {
  title: string;
  problemStatement: string;
  description: string;
  noveltyDescription: string;
  claimsDraft: string;
  developmentStage: string;
  publiclyDisclosed: boolean | null;
  previouslySold: boolean | null;
  previouslyFiled: boolean | null;
  preferredLanguage: string;
};

export function resolveCreationWizardStep(value: string | null): CreationWizardStep {
  return CREATION_WIZARD_STEPS.includes(value as CreationWizardStep) ? value as CreationWizardStep : "idea";
}

export function adjacentCreationWizardStep(step: CreationWizardStep, direction: -1 | 1) {
  const index = CREATION_WIZARD_STEPS.indexOf(step) + direction;
  return CREATION_WIZARD_STEPS[index] ?? null;
}

export function validateCreationWizardStep(step: CreationWizardStep, values: CreationWizardValues) {
  const errors: Record<string, string> = {};
  if (step === "idea") {
    if (values.title.trim().length < 3) errors.title = "Enter a title of at least 3 characters.";
    if (values.problemStatement.trim().length < 20) errors.problem_statement = "Describe the problem in at least 20 characters.";
    if (values.description.trim().length < 40) errors.invention_description = "Describe the solution in at least 40 characters.";
    if (!values.developmentStage) errors.development_stage = "Choose the current development stage.";
    if (!isSupportedVoiceLanguage(values.preferredLanguage)) errors.preferred_language = "Choose a supported voice language.";
  }
  if (step === "difference") {
    const noveltyLength = values.noveltyDescription.trim().length;
    if (noveltyLength > 0 && noveltyLength < 20) errors.novelty_description = "Use at least 20 characters, or leave this optional field empty.";
    if (values.noveltyDescription.length > 5000) errors.novelty_description = "Keep the novelty description under 5,000 characters.";
    if (values.claimsDraft.length > 10000) errors.claims_draft = "Keep the initial claim ideas under 10,000 characters.";
  }
  if (step === "activity") {
    if (values.publiclyDisclosed === null) errors.publicly_disclosed = "Choose Yes or No.";
    if (values.previouslySold === null) errors.previously_sold = "Choose Yes or No.";
    if (values.previouslyFiled === null) errors.previously_filed = "Choose Yes or No.";
  }
  return errors;
}
