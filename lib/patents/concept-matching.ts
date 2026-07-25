import type { OverlapMatchType } from "@/lib/patents/overlap-types";

export type ConceptGroup = { name: string; terms: string[] };
export type ConceptMatch = {
  matchType: OverlapMatchType;
  matchedConcepts: string[];
  missingConcepts: string[];
  matchedEvidence: string[];
  explanation: string;
  coverage: number;
};

const GENERIC = new Set([
  "operation", "system", "apparatus", "device", "medicine", "user", "component",
  "function", "current", "intended", "method", "arrangement", "primary", "result",
  "the", "and", "with", "for", "from", "that", "this", "into", "using", "only",
]);

const GROUPS = {
  compartment: { name: "compartment", terms: ["compartment", "compartments", "chamber", "drawer", "section", "dosette", "door", "lid"] },
  accessControl: { name: "access control", terms: ["lock", "locked", "lockable", "locking", "unlock", "unlocking", "restricted access"] },
  schedule: { name: "schedule or timing", terms: ["schedule", "scheduled", "prescribed time", "dose time", "predetermined time", "timed"] },
  accessAction: { name: "compartment access action", terms: ["unlock", "unlocking", "open", "opened", "release", "permit access"] },
  visual: { name: "visual indication", terms: ["visual", "light", "led", "display", "indicator", "illuminated"] },
  audible: { name: "audible indication", terms: ["audible", "audio", "buzzer", "alarm", "sound", "voice"] },
  reminder: { name: "reminder or alert", terms: ["reminder", "reminders", "alert", "notification", "signal"] },
  opening: { name: "opening event", terms: ["open", "opened", "opening", "door movement"] },
  detection: { name: "detection or acknowledgement", terms: ["detect", "detected", "detection", "sensor", "monitor", "acknowledgement"] },
  missedDose: { name: "missed-dose event", terms: ["missed dose", "not opened", "unopened", "non compliance", "absence of acknowledgement"] },
  storage: { name: "local record or history", terms: ["record", "recorded", "recording", "log", "logged", "logging", "store", "stored", "history"] },
  medication: { name: "medication or dose context", terms: ["medication", "medicine", "pill", "dose", "dosage"] },
  offline: { name: "explicit offline operation", terms: ["offline", "without internet", "no internet", "disconnected", "local only", "without network", "no cloud dependency"] },
} satisfies Record<string, ConceptGroup>;

function normalize(value: string): string {
  return value.normalize("NFKD").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function includesTerm(text: string, term: string): boolean {
  const normalizedText = normalize(text);
  const normalizedTerm = normalize(term);
  if (` ${normalizedText} `.includes(` ${normalizedTerm} `)) return true;
  if (normalizedTerm.includes(" ") || normalizedTerm.length < 5) return false;
  return normalizedText.split(" ").some((word) =>
    (word.startsWith(normalizedTerm) || normalizedTerm.startsWith(word))
    && Math.abs(word.length - normalizedTerm.length) <= 3);
}

function has(feature: string, terms: string[]): boolean {
  return terms.some((term) => includesTerm(feature, term));
}

export function featureConceptGroups(feature: string): ConceptGroup[] {
  const groups: ConceptGroup[] = [];
  const add = (...values: ConceptGroup[]) => values.forEach((value) => {
    if (!groups.some((group) => group.name === value.name)) groups.push(value);
  });

  if (has(feature, ["offline", "without internet", "no internet", "disconnected", "local only", "without network", "no cloud dependency"])) add(GROUPS.offline);
  if (has(feature, ["compartment", "compartments", "chamber", "drawer", "dosette"]) && has(feature, ["lock", "locked", "lockable", "locking", "unlock", "unlocking"])) add(GROUPS.compartment, GROUPS.accessControl);
  if (has(feature, ["schedule", "scheduled", "timed", "prescribed time", "dose time", "predetermined time"]) && has(feature, ["unlock", "unlocking", "open", "release", "access"])) add(GROUPS.schedule, GROUPS.compartment, GROUPS.accessAction);
  if (has(feature, ["visual", "light", "led", "display", "indicator", "illuminated"]) && has(feature, ["reminder", "alert", "notification", "signal"])) add(GROUPS.visual, GROUPS.reminder);
  if (has(feature, ["audible", "audio", "buzzer", "alarm", "sound", "voice"]) && has(feature, ["reminder", "alert", "notification", "signal"])) add(GROUPS.audible, GROUPS.reminder);
  if (has(feature, ["compartment", "door", "lid"]) && has(feature, ["open", "opened", "opening"]) && has(feature, ["detect", "detection", "sensor", "monitor", "acknowledgement"])) add(GROUPS.compartment, GROUPS.opening, GROUPS.detection);
  if (has(feature, ["missed dose", "missed-dose", "not opened", "unopened", "non compliance"]) && has(feature, ["record", "recording", "log", "logging", "store", "history"])) add(GROUPS.missedDose, GROUPS.storage, GROUPS.medication);

  if (!groups.length) {
    const meaningful = [...new Set(normalize(feature).split(" ").filter((word) => word.length > 2 && !GENERIC.has(word)))];
    meaningful.slice(0, 6).forEach((word) => add({ name: word, terms: [word] }));
  }
  return groups;
}

export function compareConceptGroups(feature: string, title: string, abstract: string | null): ConceptMatch {
  const groups = featureConceptGroups(feature);
  const patentText = `${title} ${abstract ?? ""}`;
  const evidence = groups.map((group) => ({
    group,
    terms: group.terms.filter((term) => includesTerm(patentText, term)),
  }));
  const matched = evidence.filter((item) => item.terms.length > 0);
  const missing = evidence.filter((item) => item.terms.length === 0);
  const matchedEvidence = [...new Set(matched.flatMap((item) => item.terms))];
  const patentWordCount = normalize(patentText).split(" ").filter(Boolean).length;
  let matchType: OverlapMatchType;

  if (!abstract?.trim() || patentWordCount < 5 || groups.length === 0) matchType = "UNCERTAIN";
  else if (groups.length === 1 && groups[0].name !== "explicit offline operation") matchType = matched.length ? "UNCERTAIN" : "NOT_FOUND";
  else if (matched.length === groups.length) matchType = "FULL";
  else if (matched.length >= 2) matchType = "PARTIAL";
  else if (matched.length === 1) matchType = "UNCERTAIN";
  else matchType = "NOT_FOUND";

  const matchedNames = matched.map((item) => item.group.name);
  const missingNames = missing.map((item) => item.group.name);
  const explanation = matchType === "FULL"
    ? `Matched concepts: ${matchedNames.join(", ")}. No essential concept group was missing from the available title and abstract.`
    : matchType === "NOT_FOUND"
      ? `No meaningful concept combination was identified. Missing concepts: ${missingNames.join(", ") || "feature-specific evidence"}.`
      : `Matched concepts: ${matchedNames.join(", ") || "limited evidence only"}. Important missing concepts: ${missingNames.join(", ") || "none identified"}.`;

  return {
    matchType,
    matchedConcepts: matchedNames,
    missingConcepts: missingNames,
    matchedEvidence,
    explanation,
    coverage: groups.length ? matched.length / groups.length : 0,
  };
}
