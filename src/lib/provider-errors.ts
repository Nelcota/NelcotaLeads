/**
 * What a lead or a search shows when its provider failed: our own Portuguese messages pass
 * through, anything else (Google's or DeepSeek's response text, SDK and runtime errors) becomes
 * a fixed sentence. The original goes to the log only.
 */

const GOOGLE_LIMIT_REACHED =
  "Limite diário de requisições ao Google atingido. A busca não foi feita; tente amanhã.";
export const SEARCH_FAILED = "O Google não respondeu à busca. Tente de novo em alguns minutos.";
export const SEARCH_NOT_CONFIGURED = "A busca no Google não está configurada.";
export const ANALYSIS_FAILED = "a IA não respondeu como esperado";
export const ANALYSIS_NOT_CONFIGURED = "o serviço de IA não está configurado";

function textOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function searchErrorMessage(error: unknown): string {
  const text = textOf(error);
  if (/^limite diário de requisições ao google/i.test(text)) return text;
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
