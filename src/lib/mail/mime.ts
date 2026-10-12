export type OutgoingEmail = {
  from: { address: string; name?: string };
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
  // Address that receives one-click unsubscribe requests (List-Unsubscribe).
  unsubscribe?: string;
  date?: Date;
};

const encoder = new TextEncoder();

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** RFC 2047 encoded-word for non-ASCII header text. */
export function encodeHeader(value: string): string {
  // oxlint-disable-next-line no-control-regex -- testing for plain ASCII
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${base64(encoder.encode(value))}?=`;
}

/** Rejects CR, LF and NUL, which would let a value start a new header or SMTP command. */
export function assertHeaderSafe(value: string, field: string): string {
  // oxlint-disable-next-line no-control-regex -- looking for line breaks and NUL
  if (/[\r\n\0]/.test(value)) throw new Error(`Valor inválido no campo ${field} do e-mail`);
  return value;
}

const MESSAGE_ID = /^<[^\s<>]{1,250}>$/;
// A plain addr-spec: no spaces, brackets, quotes or line breaks, one "@".
const ADDRESS = /^[^\s<>()[\]\\,;:"@]{1,64}@[^\s<>()[\]\\,;:"@]+\.[^\s<>()[\]\\,;:"@]+$/;
// Older ids are dropped; the root and the latest ones are what threading needs.
const MAX_REFERENCES = 10;

export function isMessageId(value: string): boolean {
  return MESSAGE_ID.test(value);
}

export function isEmailAddress(value: string): boolean {
  return value.length <= 254 && ADDRESS.test(value);
}

/** An address for a header or the SMTP envelope, refused unless it is a plain addr-spec. */
export function safeAddress(value: string, field: string): string {
  assertHeaderSafe(value, field);
  if (!isEmailAddress(value)) throw new Error(`Endereço de e-mail inválido no campo ${field}`);
  return value;
}

function formatAddress({ address, name }: { address: string; name?: string }) {
  safeAddress(address, "From");
  return name ? `${encodeHeader(name.replace(/["\\]/g, ""))} <${address}>` : address;
}

/** A plain-text, UTF-8, base64-encoded RFC 5322 message with CRLF line endings. */
export function buildMessage(email: OutgoingEmail): string {
  if (!isMessageId(assertHeaderSafe(email.messageId, "Message-ID"))) {
    throw new Error("Valor inválido no campo Message-ID do e-mail");
  }
  // Threading ids come from received mail: a malformed one is dropped, not sent.
  const inReplyTo =
    email.inReplyTo && isMessageId(assertHeaderSafe(email.inReplyTo, "In-Reply-To"))
      ? email.inReplyTo
      : null;
  const references = (email.references ?? []).filter(isMessageId).slice(-MAX_REFERENCES);
  const headers = [
    `From: ${formatAddress(email.from)}`,
    `To: ${safeAddress(email.to, "To")}`,
    // encodeHeader turns control characters into an encoded-word, so Subject is safe.
    `Subject: ${encodeHeader(email.subject)}`,
    `Date: ${(email.date ?? new Date()).toUTCString()}`,
    `Message-ID: ${email.messageId}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    // Folded one id per line, so the header never passes the 998-character limit.
    ...(references.length > 0 ? [`References: ${references.join("\r\n ")}`] : []),
    ...(email.unsubscribe
      ? [
          `List-Unsubscribe: <mailto:${safeAddress(email.unsubscribe, "List-Unsubscribe")}?subject=sair>`,
        ]
      : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  const body = base64(encoder.encode(email.text.replace(/\r?\n/g, "\r\n")))
    .match(/.{1,76}/g)
    ?.join("\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body ?? ""}\r\n`;
}

/** A unique Message-ID on the sender's domain. */
export function newMessageId(senderAddress: string): string {
  const domain = senderAddress.split("@")[1] ?? "localhost";
  return `<${crypto.randomUUID()}@${domain}>`;
}
