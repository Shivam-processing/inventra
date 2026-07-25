export type PatentSearchPlanInput = {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  technicalField: string;
  approvedFeatures: string[];
};

export type PatentSearchPlan = {
  domainAnchors: string[];
  mechanismAnchors: string[];
  featureKeywords: string[];
  strictQuery: string;
  fallbackQuery: string | null;
};

export type RelevanceSearchMode = "strict" | "fallback";

export type RelevancePatentRecord = {
  title: string;
  publicationNumber: string;
  abstract: string | null;
  applicant?: string | null;
  priorityDate?: string | null;
  publicationDate?: string | null;
  sourceId?: string;
  sourceUrl?: string;
};

export type RelevantPatentRecord<T extends RelevancePatentRecord> = T & {
  relevanceScore: number;
  searchMode: RelevanceSearchMode;
};

const GENERIC_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in",
  "into", "is", "it", "of", "on", "or", "that", "the", "to", "using", "with",
  "invention", "system", "device", "method", "component", "assembly", "arrangement",
  "function", "input", "output", "user", "primary", "current", "intended", "result",
]);

const AMBIGUOUS_WORDS = new Set(["capsule", "probe", "control"]);
const MECHANISM_HINTS = new Set([
  "access", "alert", "dose", "lock", "lockable", "locked", "locking", "log", "logging",
  "notification", "offline", "open", "opening", "record", "recording", "reminder",
  "schedule", "scheduled", "unlock", "unlocking",
]);

function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function words(value: string): string[] {
  return normalized(value).split(" ").filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(normalized).filter(Boolean))];
}

function hasAny(value: string, candidates: string[]): boolean {
  const sourceWords = new Set(words(value));
  return candidates.some((candidate) => sourceWords.has(candidate));
}

function concisePhrase(value: string, omitMechanisms: boolean): string {
  return words(value)
    .filter((word) => !GENERIC_WORDS.has(word) && !AMBIGUOUS_WORDS.has(word))
    .filter((word) => !omitMechanisms || !MECHANISM_HINTS.has(word))
    .slice(0, 6)
    .join(" ");
}

function addPhrase(target: string[], phrase: string): void {
  const clean = normalized(phrase);
  if (clean.split(" ").length >= 2 && !target.includes(clean)) target.push(clean);
}

function deriveDomainAnchors(input: PatentSearchPlanInput): string[] {
  const domainText = [input.title, input.problemStatement, input.proposedSolution, input.technicalField].join(" ");
  const anchors: string[] = [];
  const hasMedication = hasAny(domainText, ["pill", "pills", "medicine", "medicines", "medication", "medications"]);
  const hasStorageContext = hasAny(domainText, ["box", "organiser", "organizer", "dispenser", "container", "compartment", "compartments", "storage"]);

  if (hasMedication && hasStorageContext) {
    [
      "pill box", "medicine box", "pill dispenser", "medicine dispenser", "medication dispenser",
      "pill organiser", "pill organizer", "medicine organiser", "medicine organizer",
      "medication organiser", "medication organizer", "medicine container", "medication container",
      "medication compartment",
    ].forEach((phrase) => addPhrase(anchors, phrase));
  }

  addPhrase(anchors, concisePhrase(input.technicalField, true));
  addPhrase(anchors, concisePhrase(input.title, true));
  return unique(anchors).slice(0, 16);
}

function deriveMechanismAnchors(input: PatentSearchPlanInput): string[] {
  const featureText = input.approvedFeatures.join(" ");
  const inventionText = [input.title, input.problemStatement, input.proposedSolution, input.technicalField, featureText].join(" ");
  const anchors: string[] = [];
  const hasMedication = hasAny(inventionText, ["pill", "pills", "medicine", "medicines", "medication", "medications", "dose", "doses"]);

  if (hasAny(featureText, ["compartment", "compartments"]) && hasAny(featureText, ["lock", "lockable", "locked", "locking", "unlock", "unlocking"])) {
    addPhrase(anchors, "lockable compartment");
    addPhrase(anchors, "compartment unlocking");
  }
  if (hasAny(featureText, ["schedule", "scheduled", "timed", "time"]) && hasAny(featureText, ["unlock", "unlocking", "open", "opening"])) {
    addPhrase(anchors, "scheduled unlocking");
  }
  if (hasAny(featureText, ["schedule", "scheduled", "timed"]) && hasAny(featureText, ["dose", "doses", "dosage"])) {
    addPhrase(anchors, "scheduled dose");
  }
  if (hasAny(featureText, ["reminder", "reminders", "alert", "alerts", "notification", "notifications"])) {
    ["reminder alert", "alert notification"].forEach((phrase) => addPhrase(anchors, phrase));
    if (hasMedication) ["medication reminder", "medicine reminder", "dose reminder"].forEach((phrase) => addPhrase(anchors, phrase));
  }
  if (hasAny(featureText, ["missed"]) && hasAny(featureText, ["dose", "doses"]) && hasAny(featureText, ["record", "recording", "recorded", "log", "logging"])) {
    addPhrase(anchors, "missed dose recording");
    addPhrase(anchors, "missed dose logging");
  }
  if (hasAny(featureText, ["offline"])) addPhrase(anchors, "offline operation");

  input.approvedFeatures.forEach((feature) => addPhrase(anchors, concisePhrase(feature, false)));
  return unique(anchors).slice(0, 16);
}

function deriveFeatureKeywords(features: string[]): string[] {
  return unique(features.flatMap(words)
    .filter((word) => word.length > 2 && !GENERIC_WORDS.has(word) && !AMBIGUOUS_WORDS.has(word)))
    .slice(0, 24);
}

function cqlPhrase(phrase: string): string {
  return `ta="${phrase.replaceAll('"', '\\"')}"`;
}

function groupedCql(domainAnchors: string[], mechanismAnchors: string[]): string {
  if (!domainAnchors.length || !mechanismAnchors.length) return "";
  return `(${domainAnchors.map(cqlPhrase).join(" or ")}) and (${mechanismAnchors.map(cqlPhrase).join(" or ")})`;
}

export function buildPatentSearchPlan(input: PatentSearchPlanInput): PatentSearchPlan {
  const domainAnchors = deriveDomainAnchors(input);
  const mechanismAnchors = deriveMechanismAnchors(input);
  const featureKeywords = deriveFeatureKeywords(input.approvedFeatures);
  const fallbackMechanisms = unique([
    ...mechanismAnchors.flatMap(words).filter((word) => !GENERIC_WORDS.has(word) && !AMBIGUOUS_WORDS.has(word)),
    ...featureKeywords,
  ]).slice(0, 20);

  return {
    domainAnchors,
    mechanismAnchors,
    featureKeywords,
    strictQuery: groupedCql(domainAnchors, mechanismAnchors),
    fallbackQuery: groupedCql(domainAnchors, fallbackMechanisms) || null,
  };
}

function includesPhrase(value: string, phrase: string): boolean {
  return ` ${normalized(value)} `.includes(` ${normalized(phrase)} `);
}

export function scorePatentRelevance<T extends RelevancePatentRecord>(
  patent: T,
  plan: PatentSearchPlan,
  searchMode: RelevanceSearchMode,
): RelevantPatentRecord<T> | null {
  const title = patent.title ?? "";
  const abstract = patent.abstract ?? "";
  let score = 0;
  let domainMatched = false;

  for (const phrase of plan.domainAnchors) {
    if (includesPhrase(title, phrase)) {
      score += 10;
      domainMatched = true;
    }
    if (includesPhrase(abstract, phrase)) {
      score += 6;
      domainMatched = true;
    }
  }
  if (!domainMatched) return null;

  for (const phrase of plan.mechanismAnchors) {
    if (includesPhrase(title, phrase)) score += 6;
    if (includesPhrase(abstract, phrase)) score += 4;
  }
  const combined = `${title} ${abstract}`;
  for (const keyword of plan.featureKeywords) {
    if (includesPhrase(combined, keyword)) score += 1;
  }

  return score >= 10 ? { ...patent, relevanceScore: score, searchMode } : null;
}

function normalizedPublicationNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizedTitle(value: string): string {
  return normalized(value);
}

function completeness(record: RelevancePatentRecord): number {
  return (record.abstract?.trim().length ?? 0)
    + (record.applicant ? 80 : 0)
    + (record.priorityDate ? 30 : 0)
    + (record.publicationDate ? 20 : 0)
    + (record.sourceUrl ? 10 : 0);
}

export function deduplicateRelevantPatents<T extends RelevantPatentRecord<RelevancePatentRecord>>(records: T[]): T[] {
  const groups: Array<{ record: T; publications: Set<string>; titles: Set<string> }> = [];
  for (const candidate of records) {
    const publication = normalizedPublicationNumber(candidate.publicationNumber);
    const title = normalizedTitle(candidate.title);
    const matches = groups.filter((group) =>
      (publication.length > 0 && group.publications.has(publication))
      || (title.length > 0 && group.titles.has(title)));

    if (!matches.length) {
      groups.push({
        record: candidate,
        publications: new Set(publication ? [publication] : []),
        titles: new Set(title ? [title] : []),
      });
      continue;
    }

    const primary = matches[0];
    if (publication) primary.publications.add(publication);
    if (title) primary.titles.add(title);
    if (completeness(candidate) > completeness(primary.record)) primary.record = candidate;
    for (const duplicateGroup of matches.slice(1)) {
      duplicateGroup.publications.forEach((value) => primary.publications.add(value));
      duplicateGroup.titles.forEach((value) => primary.titles.add(value));
      if (completeness(duplicateGroup.record) > completeness(primary.record)) primary.record = duplicateGroup.record;
      groups.splice(groups.indexOf(duplicateGroup), 1);
    }
  }
  return groups
    .map((group) => group.record)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.title.localeCompare(b.title, "en"));
}

export function filterAndDeduplicatePatents<T extends RelevancePatentRecord>(
  records: T[],
  plan: PatentSearchPlan,
  searchMode: RelevanceSearchMode,
): RelevantPatentRecord<T>[] {
  return deduplicateRelevantPatents(records
    .map((record) => scorePatentRelevance(record, plan, searchMode))
    .filter((record): record is RelevantPatentRecord<T> => record !== null));
}

export function patentSearchTerms(plan: PatentSearchPlan, mode: RelevanceSearchMode): string[] {
  return [
    `Search mode: ${mode}`,
    ...plan.domainAnchors.map((term) => `Domain: ${term}`),
    ...plan.mechanismAnchors.map((term) => `Mechanism: ${term}`),
  ];
}
