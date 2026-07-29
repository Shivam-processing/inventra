import type { GrantMatch } from "./types";

export type GrantFilter = "all" | "high" | "likely" | "unknown" | "explore" | "direct" | "prototype" | "startup" | "msme" | "incubation" | "fellowship" | "credit" | "ip" | "state" | "open";
export function filterGrantMatches(matches: GrantMatch[], filter: GrantFilter, query = "") {
  const needle = query.trim().toLowerCase();
  return matches.filter((match) => {
    if (needle && !`${match.scheme.name} ${match.scheme.agency}`.toLowerCase().includes(needle)) return false;
    if (filter === "all") return true;
    if (filter === "high") return match.matchLevel === "HIGH";
    if (filter === "likely") return match.eligibilityStatus === "LIKELY_ELIGIBLE";
    if (filter === "unknown") return ["CHECK_REQUIREMENTS", "INSUFFICIENT_INFORMATION"].includes(match.eligibilityStatus);
    if (filter === "explore") return match.matchLevel === "EXPLORE";
    if (filter === "direct") return ["DIRECT_GRANT", "RESEARCH_GRANT"].includes(match.scheme.programmeType);
    if (filter === "prototype") return match.scheme.supportType.includes("prototype");
    if (filter === "startup") return match.scheme.supportType.includes("startup");
    if (filter === "msme") return match.scheme.supportType.includes("msme");
    if (filter === "incubation") return match.scheme.programmeType === "INCUBATION_SUPPORT";
    if (filter === "fellowship") return match.scheme.programmeType === "FELLOWSHIP";
    if (filter === "credit") return ["LOAN", "CREDIT_GUARANTEE", "INDIRECT_INVESTMENT"].includes(match.scheme.programmeType);
    if (filter === "ip") return match.scheme.programmeType === "IP_SUPPORT";
    if (filter === "state") return Boolean(match.scheme.stateSpecific);
    return match.scheme.currentlyOpenStatus === "VERIFIED_OPEN";
  });
}
