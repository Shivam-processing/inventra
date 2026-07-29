import type { TrademarkAIAnalysis, TrademarkProviderInput } from "./types";
export interface TrademarkAnalysisProvider { readonly name: string; readonly version: string; analyseTrademark(input: TrademarkProviderInput): Promise<TrademarkAIAnalysis>; }
