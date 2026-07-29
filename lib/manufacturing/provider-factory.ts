import "server-only";

import { MockManufacturingAnalysisProvider } from "./mock-provider";
import { OpenAIManufacturingAnalysisProvider } from "./openai-provider";
import type { ManufacturingAnalysisProvider } from "./provider";

export function manufacturingAnalysisProvider(): ManufacturingAnalysisProvider {
  return (process.env.MANUFACTURING_ANALYSIS_PROVIDER ?? "mock").toLowerCase() === "openai"
    ? new OpenAIManufacturingAnalysisProvider()
    : new MockManufacturingAnalysisProvider();
}
