/** Rules of the Leads dispatch: which selection can be reviewed and which e-mails are missing. */

const SELECT_FIRST = "Selecione os leads para disparar";
const NONE_SENDABLE = "Nenhum lead selecionado pode receber o primeiro e-mail";

/**
 * Why "Disparar" is off for this selection, or null when the review can open.
 * `sendable` counts the selected leads that are ready for the first e-mail.
 */
export function dispatchBlocker(state: {
  selected: number;
  sendable: number;
  limit: number;
}): string | null {
  if (state.selected === 0) return SELECT_FIRST;
  if (state.sendable === 0) return NONE_SENDABLE;
  if (state.sendable > state.limit)
    return `Selecione até ${state.limit} leads com e-mail por disparo`;
  return null;
}

/** The header's primary action: "Disparar (N)", N being the selected leads that can get it. */
export function dispatchButtonLabel(sendable: number): string {
  return `Disparar (${sendable})`;
}

/** The table bar's shortcut that selects the view's ready leads. */
export function selectReadyLabel(ready: number): string {
  return `Selecionar prontos (${ready})`;
}

/**
 * The recipients still without a draft, in the order shown: the ones "Escrever" sends to the AI.
 * A lead the last attempt left out is not retried in the same review.
 */
export function leadsWithoutDraft(
  leadIds: readonly string[],
  drafts: readonly { leadId: string }[],
  skipped: readonly { leadId: string }[],
): string[] {
  const handled = new Set([...drafts, ...skipped].map((item) => item.leadId));
  return leadIds.filter((id) => !handled.has(id));
}

/** "Escrever 3 e-mails": the only button in the review that spends AI. */
export function writeDraftsLabel(count: number): string {
  return `Escrever ${count} ${count === 1 ? "e-mail" : "e-mails"}`;
}

/**
 * First e-mails that can still go out today: the cold limit minus what was already sent today
 * and the cold e-mails already waiting in the queue. Never below zero.
 */
export function coldRemaining(room: {
  coldLimit: number;
  sentToday: number;
  queuedCold: number;
}): number {
  return Math.max(0, room.coldLimit - room.sentToday - room.queuedCold);
}

/** The review's drafts plus newly written ones; a draft already listed is not repeated. */
export function appendDrafts<T extends { id: string }>(
  current: readonly T[],
  added: readonly T[],
): T[] {
  const known = new Set(current.map((draft) => draft.id));
  return [...current, ...added.filter((draft) => !known.has(draft.id))];
}
