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

function formatAddress({ address, name }: { address: string; name?: string }) {
  return name ? `${encodeHeader(name.replace(/["\\]/g, ""))} <${address}>` : address;
}

/** A plain-text, UTF-8, base64-encoded RFC 5322 message with CRLF line endings. */
export function buildMessage(email: OutgoingEmail): string {
  const headers = [
    `From: ${formatAddress(email.from)}`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    `Date: ${(email.date ?? new Date()).toUTCString()}`,
    `Message-ID: ${email.messageId}`,
    ...(email.inReplyTo ? [`In-Reply-To: ${email.inReplyTo}`] : []),
    ...(email.references && email.references.length > 0
      ? [`References: ${email.references.join(" ")}`]
      : []),
    ...(email.unsubscribe ? [`List-Unsubscribe: <mailto:${email.unsubscribe}?subject=sair>`] : []),
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
