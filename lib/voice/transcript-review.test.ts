import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { transcriptWarnings, uniqueSentences } from "./transcript-review";

describe("voice transcript review", () => {
  const existing = "The box contains multiple medicine compartments and unlocks the correct compartment at the scheduled time.";
  it("warns for repeated and punctuation-free transcripts", () => {
    const warnings = transcriptWarnings(existing, "the product contain multiple medicine compartments and unlock only the correct compartment at the schedule time");
    assert.equal(warnings.includes("DUPLICATE"), true);
    assert.equal(warnings.includes("MISSING_PUNCTUATION"), true);
  });
  it("accepts a unique complete transcript", () => {
    assert.deepEqual(transcriptWarnings(existing, "An audible reminder is emitted after the compartment unlocks."), []);
  });
  it("removes a sentence already incorporated in generated copy", () => {
    assert.equal(uniqueSentences(`${existing} A local missed-dose record is stored.`, existing), "A local missed-dose record is stored.");
  });
  it("removes a substantially repeated transcript without changing stored text", () => {
    const repeated = `${existing} The product contain multiple medicine compartments and unlock only the correct compartment at the schedule time.`;
    assert.equal(uniqueSentences(repeated), existing);
  });
});
