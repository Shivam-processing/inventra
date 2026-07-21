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

export type InventionAnalysisInput = {
  title: string;
  problemStatement: string;
  description: string;
  imageUrls?: string[];
};

export type InventionAnalysisResult = {
  analysis: InventionAnalysis;
  clarificationQuestions: string[];
};

export type MockAnalysisResult = InventionAnalysisResult;
