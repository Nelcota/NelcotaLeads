import { SHORTCUTS } from "./shortcuts";

/** The in-app help ("?" in the sidebar) and the InfoTip next to each concept share this text. */

/** "Como funciona": the README's five steps, one line each. */
export const HOW_IT_WORKS = [
  "Você escolhe um nicho e uma cidade, ou deixa o modo automático buscar todo dia.",
  "O app encontra as empresas no Google.",
  "A IA lê o site de cada uma e dá uma nota de 0 a 100; as abaixo da nota mínima saem da lista.",
  "Você seleciona os leads, revisa os e-mails escritos pela IA e dispara pela sua caixa.",
  "Quando alguém responde, a IA conversa até haver interesse e passa a conversa para você.",
] as const;

export type GlossaryKey =
  | "score"
  | "minScore"
  | "autopilot"
  | "needsYou"
  | "aiInCharge"
  | "dailyLimit"
  | "optOut";

export const GLOSSARY: Record<GlossaryKey, { term: string; text: string }> = {
  score: {
    term: "Nota 0–100",
    text: "Quanto a empresa combina com a sua oferta, segundo a IA. Quanto maior, melhor.",
  },
  minScore: {
    term: "Nota mínima",
    text: "Empresas com nota abaixo dela são descartadas pela IA. Zero mantém todas.",
  },
  autopilot: {
    term: "Modo automático",
    text: "O que o app faz sozinho: a IA responde os e-mails, dispara para leads novos e busca empresas todo dia. Cada parte liga em separado.",
  },
  needsYou: {
    term: "Precisa de você",
    text: "A IA parou de responder porque o cliente mostrou interesse ou pediu algo que só você decide.",
  },
  aiInCharge: {
    term: "IA no comando",
    text: "A IA responde essa conversa sozinha até haver interesse. Você pode assumir quando quiser.",
  },
  dailyLimit: {
    term: "Limite diário",
    text: "Quantos e-mails saem por dia, respostas incluídas, para a sua caixa não cair no spam. As buscas no Google têm um limite próprio.",
  },
  optOut: {
    term: "Sair",
    text: 'Quem responde "sair" não recebe mais e-mails, e o lead é descadastrado.',
  },
};

/** "?" (Shift + /) opens the help from any screen. */
export const HELP_SHORTCUT = { keys: ["?"], label: "Abrir esta ajuda" } as const;

/** Every shortcut the help lists: the app's own (Conversas, lead sheet) and the help itself. */
export const HELP_SHORTCUTS = [...SHORTCUTS, HELP_SHORTCUT];

/** A key as the user's keyboard shows it ("Mod" is ⌘ on Apple systems, Ctrl elsewhere). */
export function keyLabel(key: string, apple: boolean): string {
  if (key === "Mod") return apple ? "⌘" : "Ctrl";
  if (key === "Enter") return apple ? "↵" : "Enter";
  return key;
}

/** True for the "?" that opens the help: Shift + / on most layouts. */
export function isHelpKey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}): boolean {
  return event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey;
}
