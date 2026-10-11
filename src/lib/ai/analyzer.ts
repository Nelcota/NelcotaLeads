import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output, type LanguageModelUsage } from "ai";
import {
  firstMessageSchema,
  leadAnalysisSchema,
  type LeadAnalysis,
  type SettingsInput,
} from "@/lib/schemas";
import { estimateCostUsd } from "./pricing";
import {
  analysisSystemPrompt,
  analysisUserPrompt,
  messageSystemPrompt,
  messageUserPrompt,
  type LeadContext,
} from "./prompts";

export type CallUsage = { model: string; tokensIn: number; tokensOut: number; cost: number };

export interface LeadAnalyzer {
  readonly name: string;
  analyze(
    settings: SettingsInput,
    lead: LeadContext,
  ): Promise<{ analysis: LeadAnalysis; usage: CallUsage }>;
  writeMessage(
    settings: SettingsInput,
    lead: LeadContext,
    analysis: LeadAnalysis,
  ): Promise<{ message: string; usage: CallUsage }>;
}

const CALL_TIMEOUT_MS = 90_000;

export function createDeepSeekAnalyzer(options: {
  apiKey: string;
  analysisModel: string;
  messageModel: string;
}): LeadAnalyzer {
  const deepseek = createDeepSeek({ apiKey: options.apiKey });
  // Thinking mode is on by default for V4; structured scoring does not need it and it costs tokens.
  const providerOptions = { deepseek: { thinking: { type: "disabled" as const } } };

  return {
    name: "deepseek",
    async analyze(settings, lead) {
      const result = await generateText({
        model: deepseek(options.analysisModel),
        system: analysisSystemPrompt(),
        prompt: analysisUserPrompt(settings, lead),
        output: Output.object({ schema: leadAnalysisSchema, name: "lead_analysis" }),
        providerOptions,
        temperature: 0.2,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      const analysis = leadAnalysisSchema.parse(result.output);
      // Without an offer nothing counts as an opportunity; enforce it instead of trusting the model.
      if (!settings.offer.trim()) {
        analysis.signals = [];
        analysis.painPoints = [];
      }
      return {
        analysis,
        usage: toUsage(options.analysisModel, result.usage),
      };
    },
    async writeMessage(settings, lead, analysis) {
      const result = await generateText({
        model: deepseek(options.messageModel),
        system: messageSystemPrompt(),
        prompt: messageUserPrompt(settings, lead, analysis),
        output: Output.object({ schema: firstMessageSchema, name: "first_message" }),
        providerOptions,
        temperature: 0.6,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      return {
        message: tidyMessage(firstMessageSchema.parse(result.output).firstMessage),
        usage: toUsage(options.messageModel, result.usage),
      };
    },
  };
}

function toUsage(model: string, usage: LanguageModelUsage): CallUsage {
  const tokens = {
    inputTokens: usage.inputTokens ?? 0,
    cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
  };
  return {
    model,
    tokensIn: tokens.inputTokens,
    tokensOut: tokens.outputTokens,
    cost: estimateCostUsd(model, tokens),
  };
}

export const OPT_OUT_LINE = "Se não quiser receber mensagens, é só me avisar.";

/**
 * Removes typographic tells the prompt asks the model to avoid but it sometimes still uses,
 * and guarantees the opt-out sentence sits alone on the last line.
 */
export function tidyMessage(text: string): string {
  const body = text
    .replace(OPT_OUT_LINE, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${body}\n\n${OPT_OUT_LINE}`;
}
