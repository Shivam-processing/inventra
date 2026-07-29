import { unansweredManufacturingQuestions } from "./analysis-consistency";
import { summarizeManufacturingComponents } from "./component-summary";
import type { ManufacturingAnalysis, ManufacturingProfile } from "./types";

const factors = [
  ["Requirement definition completeness", "requirementDefinitionCompleteness", 20],
  ["Component specification completeness", "componentSpecificationCompleteness", 20],
  ["Off-the-shelf component availability", "offTheShelfAvailability", 15],
  ["Custom mechanical/tooling readiness", "customMechanicalReadiness", 15],
  ["Electronics/PCB definition", "electronicsDefinition", 10],
  ["Assembly and testing definition", "assemblyTestingDefinition", 10],
  ["Risk/compliance identification", "riskComplianceIdentification", 10],
] as const;

export function readinessLabel(score: number) {
  if (score <= 24) return "Concept only";
  if (score <= 44) return "Engineering definition needed";
  if (score <= 59) return "Prototype planning";
  if (score <= 74) return "Prototype-ready with open questions";
  if (score <= 89) return "Pilot preparation";
  return "Manufacturing preparation advanced";
}

export function calculateManufacturingReadiness(analysis: ManufacturingAnalysis, profile?: ManufacturingProfile) {
  const rows = factors.map(([label, key, maximum]) => ({ label, value: analysis.readinessInputs[key], maximum }));
  const rawScore = rows.reduce((sum, row) => sum + row.value, 0);
  const unresolved = profile ? unansweredManufacturingQuestions(analysis.unresolvedQuestions, profile) : analysis.unresolvedQuestions;
  const criticalQuestions = unresolved.filter((item) => item.critical);
  const score = criticalQuestions.length ? Math.min(rawScore, 59) : Math.min(rawScore, 100);
  const summary = summarizeManufacturingComponents(analysis.components, unresolved);
  return {
    score,
    rawScore,
    label: readinessLabel(score),
    factors: rows,
    criticalQuestions,
    componentSummary: summary,
    customPartsCount: summary.customParts,
    unresolvedQuestionsCount: summary.unresolvedSpecifications,
    offTheShelfPercentage: summary.fullyOffTheShelfPercentage,
    keyTechnicalRisk: analysis.risks.find((item) => item.type === "TECHNICAL")?.risk ?? "No technical risk was supplied.",
    keySupplyChainRisk: analysis.risks.find((item) => item.type === "SUPPLY_CHAIN")?.risk ?? "No supply-chain risk was supplied.",
    recommendations: analysis.recommendations.slice(0, 3),
  };
}
