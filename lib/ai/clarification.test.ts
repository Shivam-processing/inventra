import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateClarificationQuestions,
  resolveClarificationState,
  type ClarificationInput,
} from "./clarification";

function input(overrides: Partial<ClarificationInput> = {}): ClarificationInput {
  return {
    title: "Automatic safety release mechanism",
    problemStatement: "Existing equipment can remain pressurized after an unsafe threshold is reached.",
    proposedSolution: "",
    noveltyDescription: "",
    claimsDraft: "",
    approvedFeatures: [],
    ...overrides,
  };
}

describe("generateClarificationQuestions", () => {
  it("returns no more than five deterministic questions for missing information", () => {
    const questions = generateClarificationQuestions(input());
    assert.ok(questions.length > 0);
    assert.ok(questions.length <= 5);
    assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  });

  it("asks how a triggering condition is detected only when detection is unclear", () => {
    const unclear = generateClarificationQuestions(input({
      proposedSolution: "A release mechanism activates when a pressure threshold occurs and opens a vent.",
    }));
    assert.ok(unclear.some((question) => question.id === "trigger_detection"));

    const answered = generateClarificationQuestions(input({
      proposedSolution: "An integrated pressure sensor detects the threshold, then a controller opens the vent after detection.",
      noveltyDescription: "The pressure sensor and controller operate within the integrated release housing.",
      claimsDraft: "A release housing comprising a pressure sensor, controller, and vent actuator.",
      approvedFeatures: ["A pressure sensor connected to a controller that opens the vent actuator after threshold detection."],
    }));
    assert.ok(!answered.some((question) => question.id === "trigger_detection"));
    assert.ok(!answered.some((question) => question.id === "post_trigger_action"));
  });

  it("does not ask about product attachment when the stored solution answers it", () => {
    const questions = generateClarificationQuestions(input({
      proposedSolution: "A standalone release mechanism uses a pressure sensor and controller to open a vent.",
    }));
    assert.ok(!questions.some((question) => question.id === "product_relationship"));
  });

  it("preserves valid structured clarification state", () => {
    const initial = resolveClarificationState(input(), null);
    const stored = { ...initial, revision: 2, status: "COMPLETED" as const };
    assert.deepEqual(resolveClarificationState(input(), stored), stored);
  });
});
