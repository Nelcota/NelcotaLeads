/**
 * DeepSeek list prices in USD per 1M tokens (peak hours, api-docs.deepseek.com, Oct 2026).
 * Off-peak is half price, so these are conservative estimates.
 */
const PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
  "deepseek-flash": { input: 0.3, cachedInput: 0.006, output: 1.2 },
  "deepseek-v4-flash": { input: 0.3, cachedInput: 0.006, output: 1.2 },
  "deepseek-v4-pro": { input: 1.32, cachedInput: 0.044, output: 3.96 },
};

export type TokenUsage = { inputTokens: number; cachedInputTokens: number; outputTokens: number };

/** Estimated cost in USD; models without a known price are reported as 0. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICING[model];
  if (!price) return 0;
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const cost =
    (uncached * price.input +
      usage.cachedInputTokens * price.cachedInput +
      usage.outputTokens * price.output) /
    1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
