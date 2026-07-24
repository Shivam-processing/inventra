import "server-only";

import type { InventionAnalysisInput, InventionAnalysisResult } from "@/lib/ai/types";

function inferTechnicalField(text: string) {
  const value = text.toLowerCase();
  if (/water|filter|fluid|valve|pump/.test(value)) return "Fluid handling and purification systems";
  if (/sensor|circuit|battery|electronic|signal/.test(value)) return "Electronic devices and sensing systems";
  if (/medical|patient|health|diagnos/.test(value)) return "Medical devices and healthcare technology";
  if (/software|data|algorithm|network/.test(value)) return "Computer-implemented systems";
  return "Mechanical and electromechanical systems";
}

function extractSpecificFeatures(title: string, problem: string, description: string) {
  const candidates = description
    .split(/(?:\r?\n)+|(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 10 && value.length <= 500);
  const unique = [...new Map(candidates.map((value) => [value.toLocaleLowerCase("en"), value])).values()];
  if (unique.length) return unique.slice(0, 5);

  const fallback = `${title.trim()}: ${problem.trim()}`.slice(0, 500).trim();
  return fallback.length >= 10 ? [fallback] : [title.trim()].filter((value) => value.length >= 10);
}

export class MockAIProvider {
  async analyse(input: InventionAnalysisInput): Promise<InventionAnalysisResult> {
    const description = input.description.trim();
    const firstSentence = description.split(/(?<=[.!?])\s+/)[0] || description;
    const field = inferTechnicalField(`${input.title} ${description}`);
    const keyFeatures = extractSpecificFeatures(input.title, input.problemStatement, description);

    return {
      analysis: {
        suggestedTitle: input.title.trim(),
        technicalField: field,
        problemStatement: input.problemStatement.trim(),
        proposedSolution: firstSentence,
        components: [
          "Primary functional assembly described by the inventor",
          "Supporting housing or structural body",
          "Input, control, or activation mechanism",
          "Output or delivery interface",
        ],
        workingSteps: [
          "The user prepares or activates the invention.",
          "The primary assembly receives the relevant input.",
          "The components cooperate to perform the described function.",
          "The invention produces or delivers the intended result.",
        ],
        advantages: [
          "Addresses the stated problem through an integrated arrangement.",
          "Can simplify the user workflow compared with separate components.",
          "Provides a basis for repeatable operation and further refinement.",
        ],
        unknowns: [
          "Exact dimensions, materials, and manufacturing tolerances",
          "Alternative component arrangements and optional variants",
          "Operating limits, safety constraints, and performance measurements",
        ],
        keyFeatures,
      },
      clarificationQuestions: [
        "Which component or interaction is essential for the invention to work as intended?",
        "What alternative materials, shapes, or arrangements could perform the same function?",
        "What measurable improvement does the invention provide over existing approaches?",
      ],
    };
  }
}
