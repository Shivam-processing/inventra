import type { ManufacturingAnalysis, ManufacturingProfile } from "./types";

function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function includesAny(value: string, terms: string[]) { const source = normalized(value); return terms.some((term) => source.includes(term)); }

export function unansweredManufacturingQuestions(questions: ManufacturingAnalysis["unresolvedQuestions"], profile: ManufacturingProfile) {
  return questions.filter(({ question, affectedArea }) => {
    const source = `${question} ${affectedArea}`;
    if (includesAny(source, ["quantity", "how many units", "batch size", "prototype volume"])) return false;
    if (profile.wirelessConnectivity !== "NOT_SURE" && includesAny(source, ["wireless", "wi fi", "wifi", "bluetooth", "connectivity"]) && includesAny(source, ["whether", "required", "need", "include"])) return false;
    if (profile.batteryPowered !== "NOT_SURE" && includesAny(source, ["battery", "power source", "powered"]) && includesAny(source, ["whether", "required", "need"]) && !includesAny(source, ["capacity", "runtime", "battery life", "charging", "peak current"])) return false;
    if (profile.ingressResistance !== "NOT_SURE" && includesAny(source, ["water resistance", "dust resistance", "ingress protection", "waterproof"]) && includesAny(source, ["whether", "required", "need", "what level"])) return false;
    if (profile.preferredMaterials && includesAny(source, ["which material", "what material", "material preference"])) return false;
    if (profile.dimensions && includesAny(source, ["dimensions", "size constraints", "how large", "what size"])) return false;
    if (profile.productType !== "NOT_SURE" && includesAny(source, ["product type", "physical or software", "medical device or"])) return false;
    if (profile.sourcingRegion !== "NOT_SURE" && includesAny(source, ["sourcing region", "source domestically", "source globally"])) return false;
    return true;
  });
}

function assumptionConfirmed(assumption: string, profile: ManufacturingProfile) {
  if (includesAny(assumption, ["quantity", "volume tier"])) return true;
  if (profile.sourcingRegion !== "NOT_SURE" && includesAny(assumption, ["sourcing", "india", "global", "imported", "domestic"])) return true;
  if (profile.batteryPowered !== "NOT_SURE" && includesAny(assumption, ["battery", "powered", "power source"])) return true;
  if (profile.wirelessConnectivity !== "NOT_SURE" && includesAny(assumption, ["wireless", "wi fi", "wifi", "bluetooth", "mobile application", "connectivity"])) return true;
  if (profile.componentsToAvoid && normalized(profile.componentsToAvoid).split(" ").some((term) => term.length > 4 && normalized(assumption).includes(term))) return true;
  if (profile.preferredMaterials && includesAny(assumption, ["material"])) return true;
  if (profile.productType !== "NOT_SURE" && includesAny(assumption, ["product type", "medical", "mechanical", "electronics", "software"])) return true;
  return false;
}

export function normalizeManufacturingAnalysisForProfile(analysis: ManufacturingAnalysis, profile: ManufacturingProfile): ManufacturingAnalysis {
  const sourcingOrigin = profile.sourcingRegion === "GLOBAL" ? "IMPORTED" as const : profile.sourcingRegion === "INDIA" ? "DOMESTIC" as const : "UNKNOWN" as const;
  return {
    ...analysis,
    unresolvedQuestions: unansweredManufacturingQuestions(analysis.unresolvedQuestions, profile),
    assumptions: analysis.assumptions.map((item) => {
      const confirmed = item.origin === "CONFIRMED_BY_USER" || assumptionConfirmed(item.assumption, profile);
      return { ...item, origin: confirmed ? "CONFIRMED_BY_USER" : item.origin ?? "LIKELY_ENGINEERING_REQUIREMENT", userShouldConfirm: confirmed ? false : item.userShouldConfirm };
    }),
    components: analysis.components.map((item) => {
      const confirmedPower = profile.batteryPowered === "YES" && item.category === "POWER";
      const confirmedKnown = profile.knownComponents && normalized(profile.knownComponents).includes(normalized(item.name));
      return { ...item, sourcingOrigin: item.sourcingOrigin ?? sourcingOrigin, requirementLevel: confirmedPower || confirmedKnown ? "CONFIRMED_BY_USER" : item.requirementLevel };
    }),
  };
}
