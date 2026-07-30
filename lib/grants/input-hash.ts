import type { ApplicantProfile, InventionGrantContext } from "./types";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalize(item)]));
  }
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export function createGrantInputHash(applicant: ApplicantProfile, invention: InventionGrantContext): string {
  const serialized = JSON.stringify(normalize({ applicant, invention }));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `grant-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
