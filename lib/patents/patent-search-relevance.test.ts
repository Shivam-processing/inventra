import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPatentSearchPlan,
  filterAndDeduplicatePatents,
  type RelevancePatentRecord,
} from "./patent-search-relevance";

const plan = buildPatentSearchPlan({
  title: "Offline Smart Pill Box with Single-Dose Compartment Unlocking",
  problemStatement: "People can miss medicine doses or open the wrong compartment.",
  proposedSolution: "A pill box independently unlocks only the scheduled medicine compartment and works offline.",
  technicalField: "Medication storage and dispensing",
  approvedFeatures: [
    "Independently lockable medicine compartments",
    "Scheduled compartment unlocking for a single dose",
    "Visual and audible medication reminders",
    "Local missed-dose recording",
    "Offline operation",
  ],
});

function patent(overrides: Partial<RelevancePatentRecord>): RelevancePatentRecord {
  return {
    title: "Untitled",
    publicationNumber: "EP0000000A1",
    abstract: null,
    applicant: null,
    priorityDate: null,
    publicationDate: null,
    sourceId: "fixture",
    sourceUrl: "https://example.test/patent",
    ...overrides,
  };
}

describe("EPO patent-search relevance", () => {
  it("constructs a strict query with OR inside domain and mechanism groups joined by AND", () => {
    assert.ok(plan.domainAnchors.includes("pill box"));
    assert.ok(plan.mechanismAnchors.includes("scheduled unlocking"));
    assert.match(plan.strictQuery, /^\(.+ or .+\) and \(.+ or .+\)$/);
    assert.doesNotMatch(plan.strictQuery, /ta="(?:capsule|probe|system|device|component|control)"/);
  });

  it("retains relevant medication-storage patents", () => {
    const relevant = [
      patent({ title: "Timed pill dispenser with lockable compartments", publicationNumber: "EP1000001A1", abstract: "A scheduled dose is made accessible from a medicine container." }),
      patent({ title: "Medication organiser unlocking a scheduled dose", publicationNumber: "US1000002A1", abstract: "A pill organiser restricts access to medicine compartments until a scheduled time." }),
      patent({ title: "Offline medicine reminder with missed-dose logging", publicationNumber: "WO1000003A1", abstract: "A medicine container provides a dose reminder and local missed dose recording without network access." }),
    ];

    const results = filterAndDeduplicatePatents(relevant, plan, "strict");
    assert.deepEqual(new Set(results.map((result) => result.publicationNumber)), new Set(["EP1000001A1", "US1000002A1", "WO1000003A1"]));
    assert.ok(results.every((result) => result.relevanceScore >= 10));
  });

  it("rejects CapsuleProbe, telemedicine, rewards, and security probes", () => {
    const irrelevant = [
      patent({ title: "CapsuleProbe endoscopy system", publicationNumber: "EP2000001A1", abstract: "An ingestible capsule includes an imaging probe." }),
      patent({ title: "Telemedicine consultation platform", publicationNumber: "US2000002A1", abstract: "Remote clinicians review patient messages." }),
      patent({ title: "Reward system for children", publicationNumber: "WO2000003A1", abstract: "Points are awarded for completing tasks." }),
      patent({ title: "Security monitoring probe", publicationNumber: "JP2000004A1", abstract: "A probe monitors access to a secure network device." }),
    ];

    assert.deepEqual(filterAndDeduplicatePatents(irrelevant, plan, "strict"), []);
  });

  it("does not allow an ambiguous capsule match to qualify", () => {
    const result = filterAndDeduplicatePatents([
      patent({ title: "Capsule release controller", abstract: "A capsule is released at a scheduled time." }),
    ], plan, "strict");
    assert.equal(result.length, 0);
  });

  it("deduplicates publication numbers and titles while retaining the richer record", () => {
    const results = filterAndDeduplicatePatents([
      patent({ title: "Timed pill dispenser", publicationNumber: "EP-123-456-A1", abstract: "A pill dispenser provides a scheduled dose." }),
      patent({ title: "Timed pill dispenser", publicationNumber: "US999999A1", applicant: "Example Medical", abstract: "A pill dispenser has a lockable compartment and provides a scheduled dose with a medication reminder." }),
      patent({ title: "Medication compartment access", publicationNumber: "EP123456A1", abstract: "A medication compartment supports scheduled unlocking." }),
    ], plan, "strict");

    assert.equal(results.length, 1);
    assert.equal(results[0].publicationNumber, "US999999A1");
    assert.equal(results[0].applicant, "Example Medical");
  });

  it("applies the same domain relevance gate to fallback results", () => {
    const fallback = filterAndDeduplicatePatents([
      patent({ title: "Medication dispenser reminder", publicationNumber: "EP3000001A1", abstract: "A medicine dispenser alerts for a scheduled dose." }),
      patent({ title: "Capsule endoscopy probe", publicationNumber: "EP3000002A1", abstract: "An offline imaging capsule sends an alert." }),
    ], plan, "fallback");

    assert.deepEqual(fallback.map((result) => result.publicationNumber), ["EP3000001A1"]);
    assert.equal(fallback[0].searchMode, "fallback");
  });
});
