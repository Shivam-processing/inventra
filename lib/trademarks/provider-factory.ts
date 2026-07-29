import "server-only";
import { MockTrademarkAnalysisProvider } from "./mock-provider";
import { OpenAITrademarkAnalysisProvider } from "./openai-provider";
import type { TrademarkAnalysisProvider } from "./provider";
export function trademarkAnalysisProvider(): TrademarkAnalysisProvider { return (process.env.TRADEMARK_ANALYSIS_PROVIDER ?? "mock").toLowerCase() === "openai" ? new OpenAITrademarkAnalysisProvider() : new MockTrademarkAnalysisProvider(); }
