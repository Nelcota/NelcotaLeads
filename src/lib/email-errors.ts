import type { Email } from "@/db/schema";
import { localDay } from "@/lib/format";

/** Kept on an e-mail the daily limit stopped; a retry only makes sense the next day. */
export const DAILY_LIMIT_ERROR = "Limite diário de e-mails atingido";

/** Put in front of a failed e-mail's error once it was sent again as a new e-mail. */
export const RETRIED_PREFIX = "Reenviado · ";

/** What the thread offers on a failed e-mail: a retry, "try tomorrow", or nothing (retried). */
export function failedEmailAction(
  email: Pick<Email, "error" | "createdAt">,
  today: string,
): "retry" | "tomorrow" | "retried" {
  if (email.error?.startsWith(RETRIED_PREFIX)) return "retried";
  if (email.error === DAILY_LIMIT_ERROR && localDay(email.createdAt) === today) return "tomorrow";
  return "retry";
}
