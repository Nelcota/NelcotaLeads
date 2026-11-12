/**
 * The one list of phrases and habits that make a message read as automatic. The e-mail,
 * WhatsApp and reply prompts all print it, so a phrase banned here is banned everywhere.
 */

/** Openers and fillers of automatic prospecting messages. */
const FORMULA_PHRASES = [
  "notei que",
  "percebi que",
  "encontrei vocês no Google",
  "espero que esteja bem",
  "espero que estejam bem",
  "se fizer sentido",
  "faz sentido",
  "sem compromisso",
  "proposta breve",
  "posso ajudar com isso?",
  "só passando",
  "passando para lembrar",
  "conseguiu ver",
  "ficou alguma dúvida",
  "retomando",
  "gentilmente",
  "conforme conversamos",
  "conforme mencionado",
  "15 minutos",
] as const;

/** Polite tics of generated replies. */
const REPLY_TICS = [
  "Ótima pergunta!",
  "Excelente pergunta",
  "Boa pergunta",
  "Fico à disposição",
  "Estou à disposição",
  "Agradeço o retorno",
  "Obrigado pelo retorno",
  "Espero ter ajudado",
] as const;

const GENERIC_PRAISE = ["ótima reputação", "presença digital sólida", "trabalho incrível"] as const;

const JARGON = [
  "otimizar",
  "alavancar",
  "potencializar",
  "impulsionar",
  "transformar",
  "soluções",
  "conversão",
  "captação",
  "presença digital",
  "estratégia",
] as const;

/** Every banned phrase, for checks and tests. */
export const BANNED_PHRASES: readonly string[] = [
  ...FORMULA_PHRASES,
  ...REPLY_TICS,
  ...GENERIC_PRAISE,
  ...JARGON,
];

function quoted(phrases: readonly string[]): string {
  return phrases.map((phrase) => `"${phrase}"`).join(", ");
}

/** The "Proibido" block every writing prompt carries. */
export function bannedPhrasesRule(): string {
  return `Proibido (soa como mensagem automática):
- Frases feitas: ${quoted(FORMULA_PHRASES)}.
- Tiques de resposta: ${quoted(REPLY_TICS)}.
- Elogios genéricos (${quoted(GENERIC_PRAISE)}).
- Jargão: ${JARGON.join(", ")}.
- Sem ponto de exclamação, sem emojis, sem travessão (—).
- Promessas, garantias de resultado, urgência artificial. Não mencione nota, pontuação, avaliações nem que houve análise automatizada.`;
}
