import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claimsDraftSchema, noveltyDescriptionSchema } from "./details-validation";

describe("invention technical-detail validation", () => {
  it("accepts an empty optional novelty description", () => {
    assert.equal(noveltyDescriptionSchema.parse("   "), "");
  });

  it("requires at least twenty characters when novelty is provided", () => {
    assert.equal(noveltyDescriptionSchema.safeParse("Too short").success, false);
  });

  it("trims claims while preserving numbered lines and paragraphs", () => {
    const claims = "  1. A timed compartment.\n\n2. The compartment of claim 1.  ";
    assert.equal(claimsDraftSchema.parse(claims), "1. A timed compartment.\n\n2. The compartment of claim 1.");
  });

  it("rejects claims beyond the maximum length", () => {
    assert.equal(claimsDraftSchema.safeParse("x".repeat(10_001)).success, false);
  });
});
