import { z } from "zod";

export function resolveOwnedManufacturingSelection(raw: string | null, ownedInventionIds: readonly string[]) {
  if (!raw) return { inventionId: null, error: null };
  if (!z.string().uuid().safeParse(raw).success || !ownedInventionIds.includes(raw)) return { inventionId: null, error: "The selected invention is unavailable." };
  return { inventionId: raw, error: null };
}

export function clearedManufacturingClientState(nextInventionId: string) {
  return { selectedId: nextInventionId, analysis: null, includedComponentIds: [] as string[], message: "" };
}
