import { createDeepSeekAnalyzer, type LeadAnalyzer } from "./analyzer";

export type { CallUsage, LeadAnalyzer } from "./analyzer";
export type { LeadContext } from "./prompts";

export function getAnalyzer(env: {
  DEEPSEEK_API_KEY?: string;
  AI_MODEL_ANALYSIS: string;
  AI_MODEL_MESSAGE: string;
}): LeadAnalyzer {
  if (!env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY não configurada.");
  return createDeepSeekAnalyzer({
    apiKey: env.DEEPSEEK_API_KEY,
    analysisModel: env.AI_MODEL_ANALYSIS,
    messageModel: env.AI_MODEL_MESSAGE,
  });
}
