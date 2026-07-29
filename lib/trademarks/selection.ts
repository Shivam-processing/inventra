import { z } from "zod";
export function resolveOwnedTrademarkSelection(raw: string | null, ownedIds: readonly string[]) { if (!raw) return { inventionId: null, error: null }; if (!z.string().uuid().safeParse(raw).success || !ownedIds.includes(raw)) return { inventionId: null, error: "The selected invention is unavailable." }; return { inventionId: raw, error: null }; }
