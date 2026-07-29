import { manufacturingAnalysisSchema, manufacturingInventionInputSchema, manufacturingProfileSchema, supplierSearchSnapshotSchema, type StoredManufacturingAnalysis, type SupplierSearchSnapshot } from "./types";
import { validatedSupplierUrl } from "./supplier-links";

function object(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }

export function parseSupplierSnapshot(value: unknown): SupplierSearchSnapshot | null {
  const parsed = supplierSearchSnapshotSchema.safeParse(value);
  if (!parsed.success) return null;
  return { ...parsed.data, results: parsed.data.results.filter((item) => Boolean(validatedSupplierUrl(item.sourceUrl))) };
}

export function storedManufacturingAnalysis(row: Record<string, unknown>, currentFeatureSetVersion: number): StoredManufacturingAnalysis | null {
  const analysis = manufacturingAnalysisSchema.safeParse(row.analysis_result);
  const input = object(row.input_snapshot);
  const profile = input ? manufacturingProfileSchema.safeParse(input.profile) : null;
  const invention = input ? manufacturingInventionInputSchema.safeParse(input.invention) : null;
  if (typeof row.id !== "string" || typeof row.invention_id !== "string" || typeof row.feature_set_version !== "number" || typeof row.input_hash !== "string" || typeof row.provider !== "string" || typeof row.provider_version !== "string" || !profile?.success || !invention?.success) return null;
  return {
    id: row.id,
    inventionId: row.invention_id,
    featureSetVersion: row.feature_set_version,
    inputHash: row.input_hash,
    status: row.status === "COMPLETED" ? "COMPLETED" : row.status === "PROCESSING" ? "PROCESSING" : "FAILED",
    provider: row.provider,
    providerVersion: row.provider_version,
    inputSnapshot: { invention: invention.data, profile: profile.data },
    analysisResult: analysis.success ? analysis.data : null,
    supplierSearchResult: parseSupplierSnapshot(row.supplier_search_result),
    supplierCheckedAt: typeof row.supplier_checked_at === "string" ? row.supplier_checked_at : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    completedAt: typeof row.completed_at === "string" ? row.completed_at : null,
    isOutdated: row.feature_set_version !== currentFeatureSetVersion,
  };
}
