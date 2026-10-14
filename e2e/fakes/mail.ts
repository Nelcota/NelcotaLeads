import type { Mailer } from "../../src/lib/mail/index";
import { createFakeMailer } from "../../test/fake-mailer";
import { hasFault, takeFault } from "./faults";

export type { MailboxCursor } from "../../src/lib/mail/imap";
export { newMessageId, type OutgoingEmail } from "../../src/lib/mail/mime";
export type { IncomingEmail } from "../../src/lib/mail/parse";
export type { Mailer } from "../../src/lib/mail/index";

export type E2eMailbox = ReturnType<typeof createFakeMailer>;

declare global {
  // oxlint-disable-next-line no-var -- a global shared by the app and the E2E control route
  var nelcotaE2eMailbox: E2eMailbox | undefined;
}

/** One in-memory mailbox per dev server; the E2E control route reads and fills it. */
export function e2eMailbox(): E2eMailbox {
  globalThis.nelcotaE2eMailbox ??= createFakeMailer("eu@nelcota.test");
  return globalThis.nelcotaE2eMailbox;
}

export function mailConfigured(_env: unknown): boolean {
  return true;
}

/** While the `mailbox` fault is armed, the server refuses every connection. */
function refused(): Promise<never> {
  return Promise.reject(new Error("IMAP: conexão recusada (simulada)"));
}

export function getMailer(_env: unknown): Mailer {
  const { mailer } = e2eMailbox();
  return {
    ...mailer,
    send: (email) =>
      hasFault("mailbox")
        ? Promise.reject(new Error("SMTP login: conexão recusada (simulada)"))
        : takeFault("mailSend")
          ? Promise.reject(new Error("SMTP envio: falha simulada"))
          : mailer.send(email),
    fetchNew: (cursor) => (hasFault("mailbox") ? refused() : mailer.fetchNew(cursor)),
    verify: () => (hasFault("mailbox") ? refused() : mailer.verify()),
  };
}
