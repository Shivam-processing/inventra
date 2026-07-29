import type { ManufacturingAnalysis, ManufacturingAnalysisInput } from "./types";

export interface ManufacturingAnalysisProvider {
  readonly name: string;
  readonly version: string;
  analyzeManufacturing(input: ManufacturingAnalysisInput): Promise<ManufacturingAnalysis>;
}
