import { fetchNewMessages, verifyImap, type MailboxCursor } from "./imap";
import { buildMessage, type OutgoingEmail } from "./mime";
import { parseEmail, type IncomingEmail } from "./parse";
import { smtpSend, smtpVerify } from "./smtp";
import { connectTls } from "./wire";

export type { MailboxCursor } from "./imap";
export { newMessageId, type OutgoingEmail } from "./mime";
export type { IncomingEmail } from "./parse";

/** The user's mailbox: sends through SMTP and reads replies through IMAP. */
export interface Mailer {
  readonly address: string;
  send(email: OutgoingEmail): Promise<void>;
  fetchNew(cursor: MailboxCursor): Promise<{ cursor: MailboxCursor; messages: IncomingEmail[] }>;
  verify(): Promise<void>;
}

type MailEnv = {
  MAIL_ADDRESS?: string;
  MAIL_PASSWORD?: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  IMAP_HOST: string;
  IMAP_PORT: string;
};

export function mailConfigured(env: MailEnv): boolean {
  return Boolean(env.MAIL_ADDRESS && env.MAIL_PASSWORD);
}

export function getMailer(env: MailEnv): Mailer {
  if (!env.MAIL_ADDRESS || !env.MAIL_PASSWORD) {
    throw new Error("Configure MAIL_ADDRESS e MAIL_PASSWORD para enviar e-mails.");
  }
  const address = env.MAIL_ADDRESS.toLowerCase();
  const credentials = { user: env.MAIL_ADDRESS, password: env.MAIL_PASSWORD };
  const smtp = () => connectTls(env.SMTP_HOST, Number(env.SMTP_PORT));
  const imap = () => connectTls(env.IMAP_HOST, Number(env.IMAP_PORT));

  return {
    address,
    async send(email) {
      await smtpSend(
        await smtp(),
        credentials,
        { from: address, to: email.to },
        buildMessage(email),
      );
    },
    async fetchNew(cursor) {
      const result = await fetchNewMessages(await imap(), credentials, cursor);
      const messages = await Promise.all(result.messages.map(({ raw }) => parseEmail(raw)));
      return { cursor: result.cursor, messages };
    },
    async verify() {
      await smtpVerify(await smtp(), credentials);
      await verifyImap(await imap(), credentials);
    },
  };
}
