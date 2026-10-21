import PostalMime from "postal-mime";
import { splitQuoted } from "./quoted";

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

/**
 * What the person wrote: the quoted original cut by the rules the conversation view uses
 * (splitQuoted), plus a trailing "Enviado do meu iPhone". Stricter rules here would cut for
 * good, since this is what gets saved: "De: 8h às 18h atendemos…" is a reply, not a header.
 */
export function writtenPart(text: string): string {
  return withoutPhoneSignature(splitQuoted(text.replace(/\r\n/g, "\n")).visible).trim();
}

const PHONE_SIGNATURE = /^(Enviado do meu|Sent from my) /i;

/**
 * Drops a last line such as "Enviado do meu iPhone". Looked up with lastIndexOf, not a regex
 * anchored at the end: `\n*…$` retries from every newline, quadratic on a body of blank lines.
 */
function withoutPhoneSignature(text: string): string {
  const trimmed = text.trimEnd();
  const lineStart = trimmed.lastIndexOf("\n") + 1;
  const lastLine = trimmed.slice(lineStart).trim();
  return PHONE_SIGNATURE.test(lastLine) ? trimmed.slice(0, lineStart) : trimmed;
}

/**
 * Tags never contain `<`, so `[^<>]` stops at the next one: an unclosed `<` cannot make the
 * regex rescan the rest of a hostile body, which would stall the inbox poll.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div)[^<>]*>/gi, "\n")
    .replace(/<[^<>]+>/g, "")
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
    text: writtenPart(body.slice(0, MAX_BODY)).slice(0, MAX_TEXT),
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    automatic: isAutomatic(header, from),
  };
}
