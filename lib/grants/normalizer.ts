import type { GovernmentScheme, GrantMatch } from "./types";

const ALIASES: Record<string, string> = { sisfs: "startup india seed fund scheme", ffs: "startup india fund of funds", big: "biotechnology ignition grant", sipp: "startup intellectual property protection" };
export function normalizeSchemeName(name: string) {
  const normalized = name.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/^scheme for\s+/, "").replace(/\s+/g, " ").trim();
  return ALIASES[normalized] ?? normalized;
}

function sameScheme(a: GovernmentScheme, b: GovernmentScheme) {
  const namesA = [a.name, ...(a.aliases ?? [])].map(normalizeSchemeName);
  const namesB = [b.name, ...(b.aliases ?? [])].map(normalizeSchemeName);
  if (namesA.some((name) => namesB.includes(name))) return true;
  try { const left = new URL(a.officialPortal); const right = new URL(b.officialPortal); return left.hostname === right.hostname && left.pathname.replace(/\/$/, "") === right.pathname.replace(/\/$/, ""); } catch { return false; }
}

export function mergeCuratedAndLive(curated: GrantMatch[], live: GrantMatch[]) {
  const unmatched = [...live];
  const merged = curated.map((item) => {
    const index = unmatched.findIndex((candidate) => sameScheme(item.scheme, candidate.scheme));
    if (index < 0) return item;
    const [candidate] = unmatched.splice(index, 1);
    return {
      ...item,
      score: Math.max(item.score, candidate.score),
      scheme: {
        ...item.scheme,
        sourceType: "CURATED_LIVE" as const,
        deadlineStatus: candidate.scheme.deadlineStatus,
        deadlineText: candidate.scheme.deadlineText,
        currentlyOpenStatus: candidate.scheme.currentlyOpenStatus,
        officialSources: [...item.scheme.officialSources, ...candidate.scheme.officialSources.filter((source) => !item.scheme.officialSources.some((existing) => existing.url === source.url))],
        verificationWarnings: [...new Set([...item.scheme.verificationWarnings, ...candidate.scheme.verificationWarnings])],
      },
    };
  });
  return { curated: merged, live: unmatched };
}
