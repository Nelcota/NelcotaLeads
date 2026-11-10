import { dayMonth, localDay } from "./format";

/**
 * What a lead or a search shows when its provider failed: our own Portuguese messages pass
 * through, anything else (Google's or DeepSeek's response text, SDK and runtime errors) becomes
 * a fixed sentence. The original goes to the log only.
 */

const GOOGLE_LIMIT_PREFIX = "Limite de buscas do Google de hoje atingido";
export const GOOGLE_LIMIT_REACHED = `${GOOGLE_LIMIT_PREFIX}. A busca não foi feita; tente amanhã.`;
export const SEARCH_FAILED = "O Google não respondeu à busca. Tente de novo em alguns minutos.";
export const SEARCH_NOT_CONFIGURED = "A busca no Google não está configurada.";
export const ANALYSIS_FAILED = "a IA não respondeu como esperado";
export const ANALYSIS_NOT_CONFIGURED = "o serviço de IA não está configurado";

/** The wording searches stored before 2026-11-09, still recognized and shown in the new words. */
const OLD_GOOGLE_LIMIT_PREFIX = /^limite diário de requisições ao google atingido/i;

const GOOGLE_LIMIT_PATTERN = /^limite (diário de requisições ao google|de buscas do google)/i;

/** "…: coletadas 3 de até 20 empresas.": the limit ran out in the middle of a search. */
export function googleLimitPartialMessage(found: number, maxResults: number): string {
  return `${GOOGLE_LIMIT_PREFIX}: coletadas ${found} de até ${maxResults} empresas.`;
}

function textOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function searchErrorMessage(error: unknown): string {
  const text = textOf(error);
  if (GOOGLE_LIMIT_PATTERN.test(text)) return text;
  if (/\b429\b|quota|resource_exhausted/i.test(text)) return GOOGLE_LIMIT_REACHED;
  if (/api_key não configurada/i.test(text)) return SEARCH_NOT_CONFIGURED;
  return SEARCH_FAILED;
}

/**
 * Shown inside "A análise falhou: … Tente reanalisar.", so it has no final period. `known` are
 * the app's own messages, kept as they are.
 */
export function analysisErrorMessage(error: unknown, known: readonly string[]): string {
  const text = textOf(error);
  if (known.includes(text)) return text.replace(/\.$/, "");
  if (/api_key não configurada/i.test(text)) return ANALYSIS_NOT_CONFIGURED;
  return ANALYSIS_FAILED;
}

/** A daily-limit failure that sends people to "amanhã", true only on the day it happened. */
function saysTryTomorrow(message: string): boolean {
  return GOOGLE_LIMIT_PATTERN.test(message) && /amanhã/i.test(message);
}

/**
 * A search's stored failure as shown in the list. On a later day the "tente amanhã" of a
 * daily-limit failure is wrong, so it becomes the date instead; a message stored in the old
 * wording reads in the new one. The stored message is left as is.
 */
export function searchFailureText(
  message: string | null,
  searchedAt: Date,
  today: string,
): string | null {
  if (!message) return null;
  const day = localDay(searchedAt);
  if (day === today || !saysTryTomorrow(message))
    return message.replace(OLD_GOOGLE_LIMIT_PREFIX, GOOGLE_LIMIT_PREFIX);
  return `Limite do Google atingido em ${dayMonth(day)}`;
}
