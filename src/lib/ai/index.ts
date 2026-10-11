import { createDeepSeekAnalyzer, type LeadAnalyzer } from "./analyzer";
import { createMockAnalyzer } from "./mock";

export type { CallUsage, LeadAnalyzer } from "./analyzer";
export type { LeadContext } from "./prompts";

/** Uses DeepSeek when a key is configured, otherwise the rule-based mock. */
export function getAnalyzer(env: {
  DEEPSEEK_API_KEY?: string;
  AI_MODEL_ANALYSIS: string;
  AI_MODEL_MESSAGE: string;
}): LeadAnalyzer {
  return env.DEEPSEEK_API_KEY
    ? createDeepSeekAnalyzer({
        apiKey: env.DEEPSEEK_API_KEY,
        analysisModel: env.AI_MODEL_ANALYSIS,
        messageModel: env.AI_MODEL_MESSAGE,
      })
    : createMockAnalyzer();
}
