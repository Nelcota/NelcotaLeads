import PostalMime from "postal-mime";

export type IncomingEmail = {
  from: string;
  fromName: string | null;
  subject: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  // Only what the person wrote: quoted history and signatures below it are cut.
  text: string;
  date: Date | null;
  automatic: boolean;
  // Only the start of a very large message was fetched, so the text may be partial.
  truncated?: boolean;
};

const QUOTE_START = [
  /^Em .+ escreveu:?\s*$/i,
  /^On .+ wrote:?\s*$/i,
  /^-{2,}\s*(Mensagem original|Original Message)\s*-{2,}/i,
  /^De:\s.+/i,
  /^From:\s.+/i,
  /^Enviado do meu /i,
  /^Sent from my /i,
];

/** Drops the quoted thread that mail apps append below a reply. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (QUOTE_START.some((pattern) => pattern.test(line.trim()))) break;
    if (line.trimStart().startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Bounds on what a received message can put in the database.
const MAX_SUBJECT = 300;
const MAX_NAME = 200;
const MAX_ID = 998;
const MAX_REFERENCES = 50;
// Body read before quote stripping, and what is kept after it.
const MAX_BODY = 50_000;
const MAX_TEXT = 8000;

const ID_TOKEN = /<[^\s<>]+>/g;
const MESSAGE_ID = /^<[^\s<>@]+@[^\s<>@]+>$/;
// Senders that are machines, never people: noreply@, bounces+x@, mailer-daemon@...
const MACHINE_SENDER = /^(no-?reply|do-?not-?reply|bounces?|mailer-daemon|postmaster)([+._-]|@)/i;

/** The Message-IDs in a header value, keeping only well-formed ones. */
function messageIds(value: string | undefined): string[] {
  return (value?.match(ID_TOKEN) ?? []).filter((id) => id.length <= MAX_ID && MESSAGE_ID.test(id));
}

/** Out-of-office, bounces (DSN) and other machine mail that must never get an answer back. */
export function isAutomatic(header: (name: string) => string, from: string): boolean {
  const submitted = header("auto-submitted").trim();
  return (
    // RFC 3834: anything but "no" (auto-replied, auto-generated, auto-notified...).
    (submitted !== "" && !/^no\b/i.test(submitted)) ||
    /bulk|junk|list|auto_reply/i.test(header("precedence")) ||
    // Not X-Auto-Response-Suppress: Outlook/Exchange put it on ordinary mail too.
    Boolean(header("x-autoreply") || header("x-autorespond")) ||
    /^multipart\/report\b/i.test(header("content-type").trim()) ||
    MACHINE_SENDER.test(from)
  );
}

export async function parseEmail(raw: Uint8Array): Promise<IncomingEmail> {
  const email = await PostalMime.parse(raw);
  const body = email.text ?? (email.html ? htmlToText(email.html.slice(0, 4 * MAX_BODY)) : "");
  const header = (name: string) =>
    email.headers.find((item) => item.key === name.toLowerCase())?.value ?? "";
  const from = (email.from?.address ?? "").toLowerCase().slice(0, 254);
  const date = email.date ? new Date(email.date) : null;
  return {
    from,
    fromName: email.from?.name?.slice(0, MAX_NAME) || null,
    subject: (email.subject ?? "").slice(0, MAX_SUBJECT),
    messageId: messageIds(email.messageId)[0] ?? null,
    inReplyTo: messageIds(email.inReplyTo)[0] ?? null,
    // The newest ids are at the end, and they are the ones that match our sent mail.
    references: messageIds(email.references).slice(-MAX_REFERENCES),
    text: stripQuoted(body.slice(0, MAX_BODY)).slice(0, MAX_TEXT),
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    automatic: isAutomatic(header, from),
  };
}
