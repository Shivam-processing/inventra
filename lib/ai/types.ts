export type AIStatus = "NOT_STARTED" | "PROCESSING" | "NEEDS_REVIEW" | "APPROVED" | "FAILED";

export type InventionAnalysis = {
  suggestedTitle: string;
  technicalField: string;
  problemStatement: string;
  proposedSolution: string;
  components: string[];
  workingSteps: string[];
  advantages: string[];
  unknowns: string[];
  keyFeatures: string[];
};

export type MockAnalysisResult = {
  analysis: InventionAnalysis;
  clarificationQuestions: string[];
};
