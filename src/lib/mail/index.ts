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

/**
 * Parses one message at a time. One that fails to parse is logged and skipped:
 * the cursor still moves past it, so it can never block the inbox.
 */
/** Parses only the header block of a raw message. */
async function parseHeaders(raw: Uint8Array): Promise<IncomingEmail> {
  let end = raw.length;
  for (let i = 0; i + 3 < raw.length; i++) {
    if (raw[i] === 13 && raw[i + 1] === 10 && raw[i + 2] === 13 && raw[i + 3] === 10) {
      end = i + 4;
      break;
    }
  }
  return parseEmail(raw.subarray(0, end));
}

export async function parseAll(
  raws: { uid: number; raw: Uint8Array; truncated?: boolean }[],
): Promise<IncomingEmail[]> {
  const messages: IncomingEmail[] = [];
  for (const { uid, raw, truncated } of raws) {
    try {
      messages.push({ ...(await parseEmail(raw)), truncated: truncated ?? false });
    } catch (error) {
      // A message cut mid-part can fail to parse; its headers still say who it is from,
      // so a person gets it instead of it being dropped.
      const headers = truncated ? await parseHeaders(raw).catch(() => null) : null;
      if (headers) {
        messages.push({ ...headers, text: "", truncated: true });
        continue;
      }
      console.warn(`mail: skipping unparsable message uid ${uid}`, error);
    }
  }
  return messages;
}

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
      return { cursor: result.cursor, messages: await parseAll(result.messages) };
    },
    async verify() {
      await smtpVerify(await smtp(), credentials);
      await verifyImap(await imap(), credentials);
    },
  };
}
