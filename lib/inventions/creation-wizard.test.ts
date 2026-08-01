import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adjacentCreationWizardStep, CREATION_WIZARD_STEPS, resolveCreationWizardStep, validateCreationWizardStep, type CreationWizardValues } from "./creation-wizard";

const valid: CreationWizardValues = {
  title: "A useful invention",
  problemStatement: "A sufficiently detailed problem statement.",
  description: "A sufficiently detailed description of the proposed technical solution.",
  noveltyDescription: "",
  claimsDraft: "",
  developmentStage: "concept",
  publiclyDisclosed: false,
  previouslySold: false,
  previouslyFiled: false,
  preferredLanguage: "en-IN",
};

describe("invention creation wizard", () => {
  it("has four stable, browser-addressable steps", () => assert.deepEqual(CREATION_WIZARD_STEPS, ["idea", "difference", "activity", "review"]));
  it("falls back safely and supports previous/next navigation", () => {
    assert.equal(resolveCreationWizardStep("unknown"), "idea");
    assert.equal(adjacentCreationWizardStep("difference", -1), "idea");
    assert.equal(adjacentCreationWizardStep("activity", 1), "review");
  });
  it("blocks incomplete required fields while keeping claims optional", () => {
    assert.deepEqual(validateCreationWizardStep("idea", valid), {});
    assert.deepEqual(validateCreationWizardStep("difference", valid), {});
    assert.ok(validateCreationWizardStep("idea", { ...valid, title: "" }).title);
  });
  it("requires explicit disclosure answers", () => {
    assert.ok(validateCreationWizardStep("activity", { ...valid, previouslyFiled: null }).previously_filed);
  });
});
