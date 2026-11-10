/** Shown next to "Enviar" while no e-mail inbox is connected. */
export const MAIL_MISSING_REASON = "Conecte o e-mail para enviar";

export type ReplySendState = { canSend: boolean; reason: string | null };

/**
 * Whether the reply can go out now, and why not when the user has to act first. An inbox
 * status still loading (`undefined`) does not block: the server checks again on send.
 */
export function replySendState({
  body,
  pending,
  mailConfigured,
}: {
  body: string;
  pending: boolean;
  mailConfigured: boolean | undefined;
}): ReplySendState {
  if (mailConfigured === false) return { canSend: false, reason: MAIL_MISSING_REASON };
  return { canSend: body.trim() !== "" && !pending, reason: null };
}
