import { z } from "zod";

export const clarificationQuestionIdSchema = z.enum([
  "problem_scope",
  "main_component",
  "trigger_detection",
  "post_trigger_action",
  "product_relationship",
  "technical_difference",
  "claim_boundaries",
]);

export type ClarificationQuestionId = z.infer<typeof clarificationQuestionIdSchema>;
export type ClarificationStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type ClarificationInput = {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  noveltyDescription: string;
  claimsDraft: string;
  approvedFeatures: string[];
};

export const clarificationItemSchema = z.object({
  id: clarificationQuestionIdSchema,
  question: z.string().trim().min(10).max(300),
  affects: z.string().trim().min(2).max(120),
  optional: z.literal(true),
  answer: z.string().trim().max(3000),
  skipped: z.boolean(),
});

export const clarificationStateSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
  featureReviewRequired: z.boolean(),
  items: z.array(clarificationItemSchema).max(5),
  updatedAt: z.string().datetime().nullable(),
});

export type ClarificationItem = z.infer<typeof clarificationItemSchema>;
export type ClarificationState = z.infer<typeof clarificationStateSchema>;

type QuestionDefinition = Omit<ClarificationItem, "answer" | "skipped"> & {
  needed(input: ClarificationInput, combined: string): boolean;
};

function meaningful(value: string, minimum = 30) {
  const normalized = value.trim();
  return normalized.length >= minimum && !/^(unknown|none|n\/a|not sure|to be determined|tbd)[.!]?$/i.test(normalized);
}

function includesAny(value: string, terms: RegExp) {
  return terms.test(value.toLocaleLowerCase("en"));
}

const definitions: QuestionDefinition[] = [
  {
    id: "problem_scope",
    question: "What specific technical limitation occurs in the existing approach?",
    affects: "Problem statement",
    optional: true,
    needed: (input) => !meaningful(input.problemStatement, 45),
  },
  {
    id: "main_component",
    question: "What component performs the main action?",
    affects: "Proposed solution and features",
    optional: true,
    needed: (input) => !meaningful(input.proposedSolution, 45)
      || (!input.approvedFeatures.length && !includesAny(input.proposedSolution, /\b(component|module|assembly|sensor|controller|processor|mechanism|valve|motor|circuit|housing|member|element)\b/)),
  },
  {
    id: "trigger_detection",
    question: "How is the triggering condition detected?",
    affects: "Proposed solution and working steps",
    optional: true,
    needed: (_input, combined) => includesAny(combined, /\b(trigger|condition|activate|activation|event|threshold)\b/)
      && !includesAny(combined, /\b(detect|detector|sensor|sense|monitor|measurement|switch|signal|threshold comparator)\b/),
  },
  {
    id: "post_trigger_action",
    question: "What happens after the triggering condition occurs?",
    affects: "Working steps and claims draft",
    optional: true,
    needed: (_input, combined) => includesAny(combined, /\b(trigger|condition|activate|activation|event|threshold)\b/)
      && !includesAny(combined, /\b(after|then|subsequently|causes|moves|opens|closes|releases|transmits|produces|delivers|stops)\b/),
  },
  {
    id: "product_relationship",
    question: "Is the invention attached to an existing product or used independently?",
    affects: "Proposed solution and claim scope",
    optional: true,
    needed: (_input, combined) => !includesAny(combined, /\b(attached|mounted|integrated|built[- ]?in|retrofit|standalone|independent|existing product|separate product)\b/),
  },
  {
    id: "technical_difference",
    question: "Which technical feature is different from existing solutions?",
    affects: "Novelty description and features",
    optional: true,
    needed: (input) => !meaningful(input.noveltyDescription, 35) && input.approvedFeatures.length === 0,
  },
  {
    id: "claim_boundaries",
    question: "Which components or interactions are essential and should appear in the claims draft?",
    affects: "Claims draft and features",
    optional: true,
    needed: (input) => !meaningful(input.claimsDraft, 40) && input.approvedFeatures.length === 0,
  },
];

export function generateClarificationQuestions(input: ClarificationInput): ClarificationItem[] {
  const combined = [
    input.title,
    input.problemStatement,
    input.proposedSolution,
    input.noveltyDescription,
    input.claimsDraft,
    ...input.approvedFeatures,
  ].join("\n");

  return definitions
    .filter((definition) => definition.needed(input, combined))
    .slice(0, 5)
    .map((definition) => ({
      id: definition.id,
      question: definition.question,
      affects: definition.affects,
      optional: definition.optional,
      answer: "",
      skipped: false,
    }));
}

export function parseClarificationState(value: unknown): ClarificationState | null {
  const parsed = clarificationStateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function resolveClarificationState(input: ClarificationInput, stored: unknown): ClarificationState {
  const existing = parseClarificationState(stored);
  if (existing) return existing;

  return {
    schemaVersion: 1,
    revision: 0,
    status: "NOT_STARTED",
    featureReviewRequired: false,
    items: generateClarificationQuestions(input),
    updatedAt: null,
  };
}

export function clarificationAnswerText(value: unknown): string {
  const state = parseClarificationState(value);
  if (!state) return "";
  return state.items
    .filter((item) => item.answer.length > 0 && !item.skipped)
    .map((item) => `${item.question}\n${item.answer}`)
    .join("\n\n");
}
