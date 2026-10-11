import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output, type LanguageModelUsage } from "ai";
import {
  areasSchema,
  emailReplySchema,
  firstMessageSchema,
  followUpSchema,
  leadAnalysisSchema,
  outreachEmailSchema,
  type EmailReplyDecision,
  type LeadAnalysis,
  type OutreachEmail,
  type SettingsInput,
} from "@/lib/schemas";
import { estimateCostUsd } from "./pricing";
import {
  analysisSystemPrompt,
  analysisUserPrompt,
  areasPrompt,
  emailSystemPrompt,
  emailUserPrompt,
  followUpSystemPrompt,
  followUpUserPrompt,
  messageSystemPrompt,
  messageUserPrompt,
  replySystemPrompt,
  replyUserPrompt,
  type LeadContext,
  type ThreadMessage,
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
  writeFollowUp(
    settings: SettingsInput,
    lead: LeadContext,
    sent: { firstMessage: string; daysSince: number },
  ): Promise<{ message: string; usage: CallUsage }>;
  writeEmail(
    settings: SettingsInput,
    lead: LeadContext,
    analysis: LeadAnalysis,
  ): Promise<{ email: OutreachEmail; usage: CallUsage }>;
  /** Decides how to answer the latest message of an e-mail conversation. */
  replyEmail(
    settings: SettingsInput,
    lead: LeadContext,
    thread: ThreadMessage[],
  ): Promise<{ decision: EmailReplyDecision; usage: CallUsage }>;
  /** Neighborhoods of a city, used to vary the daily searches. */
  listAreas(city: string): Promise<{ areas: string[]; usage: CallUsage }>;
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
    async writeFollowUp(settings, lead, sent) {
      const result = await generateText({
        model: deepseek(options.messageModel),
        system: followUpSystemPrompt(),
        prompt: followUpUserPrompt(settings, lead, sent),
        output: Output.object({ schema: followUpSchema, name: "follow_up" }),
        providerOptions,
        temperature: 0.6,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      return {
        message: cleanText(followUpSchema.parse(result.output).message),
        usage: toUsage(options.messageModel, result.usage),
      };
    },
    async writeEmail(settings, lead, analysis) {
      const write = async (extra: string) => {
        const result = await generateText({
          model: deepseek(options.messageModel),
          system: emailSystemPrompt(),
          prompt: emailUserPrompt(settings, lead, analysis) + extra,
          output: Output.object({ schema: outreachEmailSchema, name: "outreach_email" }),
          providerOptions,
          temperature: 0.6,
          abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        });
        const email = outreachEmailSchema.parse(result.output);
        return {
          email: { subject: cleanText(email.subject), body: cleanText(email.body) },
          usage: toUsage(options.messageModel, result.usage),
        };
      };
      // The prompt forbids these, but the model still slips; one rewrite fixes most cases.
      const first = await write("");
      const tells = findTells(`${first.email.subject}\n${first.email.body}`);
      if (tells.length === 0) return first;
      const second = await write(
        `\n\n## Reescreva sem\n${tells.map((tell) => `- ${tell}`).join("\n")}`,
      );
      return { email: second.email, usage: addUsage(first.usage, second.usage) };
    },
    async replyEmail(settings, lead, thread) {
      const result = await generateText({
        model: deepseek(options.messageModel),
        system: replySystemPrompt(),
        prompt: replyUserPrompt(settings, lead, thread),
        output: Output.object({ schema: emailReplySchema, name: "email_reply" }),
        providerOptions,
        temperature: 0.3,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      const decision = emailReplySchema.parse(result.output);
      return {
        decision: {
          ...decision,
          reply: cleanText(decision.reply),
          draft: cleanText(decision.draft),
        },
        usage: toUsage(options.messageModel, result.usage),
      };
    },
    async listAreas(city) {
      const result = await generateText({
        model: deepseek(options.analysisModel),
        prompt: areasPrompt(city),
        output: Output.object({ schema: areasSchema, name: "areas" }),
        providerOptions,
        temperature: 0,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      const areas = [
        ...new Set(areasSchema.parse(result.output).areas.map((area) => area.trim())),
      ].filter((area) => area.length > 1 && area.length <= 60);
      return { areas, usage: toUsage(options.analysisModel, result.usage) };
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

const TELLS: [RegExp, string][] = [
  [/\bsou (um |uma )?[a-zçãéê]+(?=[ ,.])/i, 'apresentação com cargo ou profissão ("sou ...")'],
  [/notei que|percebi que/i, '"notei que" ou "percebi que"'],
  [/fizer sentido|faz sentido|sem compromisso/i, '"faz sentido" ou "sem compromisso"'],
  [/espero que (esteja|estejam) bem/i, '"espero que esteja bem"'],
  [/reputa[çc][ãa]o|avalia[çc][õo]es|nota \d/i, "menção a avaliações, nota ou reputação"],
];

/** Generated-text tells the prompt forbids; used to ask for one rewrite. */
export function findTells(text: string): string[] {
  return TELLS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

function addUsage(a: CallUsage, b: CallUsage): CallUsage {
  return {
    model: a.model,
    tokensIn: a.tokensIn + b.tokensIn,
    tokensOut: a.tokensOut + b.tokensOut,
    cost: a.cost + b.cost,
  };
}

export const OPT_OUT_LINE = "Se não quiser receber mensagens, é só me avisar.";

/**
 * Removes typographic tells the prompt asks the model to avoid but it sometimes still uses,
 * and guarantees the opt-out sentence sits alone on the last line.
 */
export function tidyMessage(text: string): string {
  return `${cleanText(text.replace(OPT_OUT_LINE, ""))}\n\n${OPT_OUT_LINE}`;
}

/** Dashes become commas and blank-line runs collapse (typographic tells of generated text). */
export function cleanText(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
