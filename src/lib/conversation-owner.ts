/** Who answers a conversation's e-mails: the AI, or the team. */
export type ConversationOwner = {
  answeredBy: "ai" | "you";
  /** The header's statement of who answers. */
  label: string;
  /** The one control that hands the conversation to the other side. */
  action: { label: string; aiMode: boolean };
};

const AI_ANSWERS: ConversationOwner = {
  answeredBy: "ai",
  label: "A IA responde esta conversa",
  action: { label: "Assumir conversa", aiMode: false },
};

const YOU_ANSWER: ConversationOwner = {
  answeredBy: "you",
  label: "Você responde esta conversa",
  action: { label: "Devolver para a IA", aiMode: true },
};

/** What the conversation header says about who answers, and the control that switches it. */
export function conversationOwner(aiMode: boolean): ConversationOwner {
  if (aiMode) return AI_ANSWERS;
  return YOU_ANSWER;
}
