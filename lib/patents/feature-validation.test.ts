import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findFeatureDuplicates, validateFeatureSet } from "./feature-validation";

describe("approved feature duplicate detection", () => {
  it("finds exact and punctuation-only duplicates", () => {
    const findings = findFeatureDuplicates(["Scheduled compartment unlocking", "Scheduled compartment unlocking."]);
    assert.equal(findings[0]?.kind, "EXACT");
    assert.equal(validateFeatureSet(["Scheduled compartment unlocking", "Scheduled compartment unlocking."], "Scheduled compartment unlocking").success, false);
  });
  it("finds contained and combined feature sentences", () => {
    const features = [
      "Independently lockable medicine compartments",
      "Scheduled compartment unlocking",
      "Compartment-opening detection",
      "Local missed-dose recording",
      "A medicine box containing multiple independently lockable compartments.",
      "The box detects whether the unlocked compartment was opened and stores a missed-dose record when it remains unopened after the allowed time.",
    ];
    const findings = findFeatureDuplicates(features);
    assert.equal(findings.some((item) => item.index === 4 && item.kind === "LIKELY"), true);
    assert.equal(findings.some((item) => item.index === 5 && item.duplicateOf.length >= 2), true);
  });
  it("does not mark unrelated supported features as duplicates", () => {
    assert.deepEqual(findFeatureDuplicates(["Visual medicine reminder at the scheduled time", "Local offline missed-dose event recording"]), []);
  });
});
