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

export async function parseEmail(raw: Uint8Array): Promise<IncomingEmail> {
  const email = await PostalMime.parse(raw);
  const body = email.text ?? (email.html ? htmlToText(email.html) : "");
  const header = (name: string) =>
    email.headers.find((item) => item.key === name.toLowerCase())?.value ?? "";
  return {
    from: (email.from?.address ?? "").toLowerCase(),
    fromName: email.from?.name || null,
    subject: email.subject ?? "",
    messageId: email.messageId ?? null,
    inReplyTo: email.inReplyTo ?? null,
    references: (email.references ?? "").split(/\s+/).filter(Boolean),
    text: stripQuoted(body).slice(0, 8000),
    date: email.date ? new Date(email.date) : null,
    // Auto-replies (out of office, bounces) must never get an answer back.
    automatic:
      /^auto-(replied|generated)/i.test(header("auto-submitted")) ||
      /bulk|junk|list|auto_reply/i.test(header("precedence")) ||
      Boolean(header("x-autoreply")) ||
      /mailer-daemon|postmaster/i.test(email.from?.address ?? ""),
  };
}
