const LEGAL_SUFFIXES = /\b(?:private\s+limited|pvt\.?\s*ltd\.?|limited|ltd\.?|llp|inc\.?|corporation|corp\.?)\s*$/iu;

export function normalizeTrademarkName(originalName: string, removeLegalSuffix = true) {
  let value = originalName.replace(/[™®©]/g, " ").normalize("NFKC").replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2").replace(/[‘’`´]/g, "'").replace(/[‐‑‒–—−]/g, "-").toLocaleLowerCase("en-IN").trim();
  value = value.replace(/[_/\\.,:;!?()[\]{}+*=|@#$%^~]/g, " ").replace(/[-'&]+/g, " ").replace(/\s+/g, " ").trim();
  if (removeLegalSuffix) value = value.replace(LEGAL_SUFFIXES, "").trim();
  const compactName = value.replace(/[^\p{L}\p{N}]/gu, "");
  return { originalName: originalName.trim(), normalizedName: value, compactName, tokens: value.split(" ").filter(Boolean) };
}

export function normalizedTrademarkEquals(a: string, b: string) { return normalizeTrademarkName(a).normalizedName === normalizeTrademarkName(b).normalizedName; }
