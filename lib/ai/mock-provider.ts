import "server-only";

import type { InventionAnalysisInput, InventionAnalysisResult } from "@/lib/ai/types";

const boilerplate = /primary functional assembly|supporting housing or structural body|input, control, or activation mechanism|output or delivery interface|intended result|components cooperate|integrated arrangement|repeatable operation|further refinement/i;

type SupportedConcept = {
  label: string;
  supported: (text: string) => boolean;
};

const supportedConcepts: SupportedConcept[] = [
  {
    label: "Independently lockable medicine compartments",
    supported: (text) => /\b(?:medicine|medication|pill)\b/i.test(text)
      && /\bcompartments?\b/i.test(text)
      && /\b(?:independent|individual|separate|each)\w*\b/i.test(text)
      && /\b(?:lock|unlock)\w*\b/i.test(text),
  },
  {
    label: "Scheduled compartment unlocking",
    supported: (text) => /\bcompartments?\b/i.test(text)
      && /\b(?:schedule|scheduled|time|timed)\w*\b/i.test(text)
      && /\b(?:unlock|open|release)\w*\b/i.test(text),
  },
  {
    label: "Visual reminders",
    supported: (text) => /\b(?:visual|light|display|LED)\b/i.test(text)
      && /\b(?:remind|alert|notif)\w*\b/i.test(text),
  },
  {
    label: "Audible reminders",
    supported: (text) => /\b(?:audible|sound|alarm|buzzer)\w*\b/i.test(text)
      && /\b(?:remind|alert|notif)\w*\b/i.test(text),
  },
  {
    label: "Compartment-opening detection",
    supported: (text) => /\bcompartments?\b/i.test(text)
      && /\bopen(?:ing|ed)?\b/i.test(text)
      && /\b(?:detect|monitor|track|record)\w*\b/i.test(text),
  },
  {
    label: "Local missed-dose recording",
    supported: (text) => /\bmissed[ -]?dose\b/i.test(text)
      && /\b(?:local|device|intern)\w*\b/i.test(text)
      && /\b(?:record|log|store)\w*\b/i.test(text),
  },
  {
    label: "Offline operation",
    supported: (text) => /\b(?:offline|without (?:an )?internet|no internet|without network|no network)\b/i.test(text),
  },
];

function fragments(value: string) {
  return value
    .split(/(?:\r?\n)+|(?<=[.!?;])\s+|\s+[•·]\s+/)
    .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((item) => item.length >= 10 && item.length <= 500 && !boilerplate.test(item));
}

function unique(values: string[], limit: number) {
  return [...new Map(values.map((value) => [value.toLocaleLowerCase("en"), value])).values()].slice(0, limit);
}

function inferTechnicalField(text: string) {
  if (/\b(?:medicine|medication|pill|dose|patient|medical|health|diagnos)\w*\b/i.test(text)) return "Medical devices and healthcare technology";
  if (/\b(?:water|filter|fluid|valve|pump)\w*\b/i.test(text)) return "Fluid handling and purification systems";
  if (/\b(?:sensor|circuit|battery|electronic|signal)\w*\b/i.test(text)) return "Electronic devices and sensing systems";
  if (/\b(?:software|data|algorithm|network)\w*\b/i.test(text)) return "Computer-implemented systems";
  return "Technical field not specified in the disclosure";
}

function explicitComponents(source: string, concepts: string[]) {
  const componentConcepts = concepts.filter((concept) => concept === "Independently lockable medicine compartments");
  const componentSentences = fragments(source).filter((sentence) =>
    /\b(?:compris|include|contain|consist|component|compartment|device|module|unit|mechanism|controller|detector|display|alarm|buzzer|lock|container|box|circuit|valve|pump|filter|chamber)\w*\b/i.test(sentence),
  );
  return unique([...componentConcepts, ...componentSentences], 10);
}

function workingSteps(source: string, concepts: string[]) {
  const supportedSteps = [
    concepts.includes("Scheduled compartment unlocking") ? "Unlock the scheduled medicine compartment" : "",
    concepts.includes("Visual reminders") ? "Provide a visual reminder" : "",
    concepts.includes("Audible reminders") ? "Provide an audible reminder" : "",
    concepts.includes("Compartment-opening detection") ? "Detect that a medicine compartment has been opened" : "",
    concepts.includes("Local missed-dose recording") ? "Record a missed dose locally" : "",
  ].filter(Boolean);
  const statedSteps = fragments(source).filter((sentence) =>
    /\b(?:first|then|after|before|when|detect|unlock|open|record|remind|alert|activate|receive|release|provide)\w*\b/i.test(sentence),
  );
  return unique([...supportedSteps, ...statedSteps], 10);
}

function statedAdvantages(source: string) {
  const candidates = fragments(source).filter((sentence) =>
    /\b(?:reduce|prevent|avoid|improve|enable|allow|ensure|help|simplif|faster|safer|reliable|offline|missed[ -]?dose)\w*\b/i.test(sentence),
  );
  return unique(candidates, 8);
}

function unknownTopics(source: string, components: string[], steps: string[], advantages: string[]) {
  const values: string[] = [];
  if (!components.length) values.push("The specific components and their relationships are not described.");
  if (!steps.length) values.push("The operating sequence and triggering conditions are not described.");
  if (!advantages.length) values.push("The disclosure does not state a specific technical improvement over existing approaches.");
  if (/\b(?:schedule|scheduled|timed?)\w*\b/i.test(source) && !/\b(?:clock|timer|timekeeping|schedule (?:is )?(?:stored|set|entered))\b/i.test(source)) {
    values.push("How the schedule is stored and evaluated requires clarification.");
  }
  if (/\b(?:lock|unlock)\w*\b/i.test(source) && !/\b(?:how|mechanism|actuator|motor|manual|electronic)\b/i.test(source)) {
    values.push("The disclosed text does not explain how locking or unlocking is performed.");
  }
  if (/\b(?:remind|alert|notif)\w*\b/i.test(source) && !/\b(?:trigger|when|schedule|time|condition)\w*\b/i.test(source)) {
    values.push("The condition that triggers each reminder requires clarification.");
  }
  if (!/\b(?:essential|required|optional)\w*\b/i.test(source)) {
    values.push("Which disclosed elements are essential and which are optional requires clarification.");
  }
  return unique(values, 8);
}

function extractFeatures(source: string) {
  const concepts = supportedConcepts.filter((concept) => concept.supported(source)).map((concept) => concept.label);
  const statedFeatures = fragments(source).filter((sentence) =>
    /\b(?:compris|include|provide|enable|allow|detect|unlock|lock|record|operate|remind|alert|different|novel|feature)\w*\b/i.test(sentence),
  );
  return { concepts, features: unique([...concepts, ...statedFeatures], 10) };
}

export class MockAIProvider {
  async analyse(input: InventionAnalysisInput): Promise<InventionAnalysisResult> {
    const proposedSolution = input.proposedSolution?.trim() || fragments(input.description)[0] || input.description.trim();
    const solutionSource = [
      input.description,
      proposedSolution,
      input.noveltyDescription,
      input.claimsDraft,
      input.clarificationAnswers,
    ].filter((value): value is string => Boolean(value?.trim())).join("\n");
    const fullSource = [input.title, input.problemStatement, solutionSource].filter(Boolean).join("\n");
    const { concepts, features } = extractFeatures(solutionSource);
    const components = explicitComponents(solutionSource, concepts);
    const steps = workingSteps(solutionSource, concepts);
    const advantages = statedAdvantages(solutionSource);

    return {
      analysis: {
        suggestedTitle: input.title.trim(),
        technicalField: inferTechnicalField(fullSource),
        problemStatement: input.problemStatement.trim(),
        proposedSolution,
        components,
        workingSteps: steps,
        advantages,
        unknowns: unknownTopics(solutionSource, components, steps, advantages),
        keyFeatures: features,
      },
      clarificationQuestions: [
        "Which disclosed components are essential to the invention?",
        "What exact condition starts the stated operating sequence?",
        "Which stated technical feature differs from existing solutions?",
      ],
    };
  }
}
