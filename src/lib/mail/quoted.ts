export type SplitBody = { visible: string; quoted: string | null };

// "Em seg., 12 de out. de 2026 às 10:00, Ana <ana@x.com> escreveu:" (Gmail, Apple Mail).
const ATTRIBUTION = /^(em|on)\s.+\s(escreveu|wrote)\s*:?\s*$/i;
const ORIGINAL_MESSAGE = /^-{2,}\s*(original message|mensagem original)\s*-{2,}\s*$/i;
// Outlook: a "De:/From:" line followed shortly by "Enviado:/Sent:".
const OUTLOOK_FROM = /^\*?(de|from)\s*:\*?\s/i;
const OUTLOOK_SENT = /^\*?(enviado|enviada|sent|data|date)\s*(em)?\s*:\*?\s/i;
const OUTLOOK_RULE = /^_{10,}\s*$/;
const QUOTE_LINE = /^>/;
// Gmail wraps a long attribution; the "escreveu:" may land on the next line.
const ATTRIBUTION_SPAN = 2;
const OUTLOOK_SPAN = 4;

/** Index of the line where the quoted original starts, or -1. */
function quoteStart(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (ORIGINAL_MESSAGE.test(line)) return i;
    if (/^(em|on)\s/i.test(line)) {
      const span = lines
        .slice(i, i + ATTRIBUTION_SPAN)
        .map((item) => item.trim())
        .join(" ");
      // Always dated, which keeps "Em resumo, ele escreveu:" in the text.
      if ((ATTRIBUTION.test(line) || ATTRIBUTION.test(span)) && /\d/.test(span)) return i;
    }
    if (OUTLOOK_FROM.test(line)) {
      const next = lines.slice(i + 1, i + 1 + OUTLOOK_SPAN).map((item) => item.trim());
      if (next.some((item) => OUTLOOK_SENT.test(item))) {
        // The rule Outlook draws above the header belongs to the quote.
        const above = (lines[i - 1] ?? "").trim();
        return OUTLOOK_RULE.test(above) ? i - 1 : i;
      }
    }
  }
  return trailingQuoteStart(lines);
}

/** Where a final block of "> " lines starts (blank lines inside it allowed), or -1. */
function trailingQuoteStart(lines: string[]): number {
  let i = lines.length - 1;
  while (i >= 0 && !(lines[i] ?? "").trim()) i--;
  if (i < 0 || !QUOTE_LINE.test((lines[i] ?? "").trim())) return -1;
  let start = i;
  for (; i >= 0; i--) {
    const line = (lines[i] ?? "").trim();
    if (QUOTE_LINE.test(line)) {
      start = i;
      continue;
    }
    if (line !== "") break;
  }
  return start;
}

/**
 * Splits a received e-mail into what the person wrote and the quoted original below it
 * (Gmail/Apple Mail "Em … escreveu:", Outlook "De:/Enviado:", "Original Message", a final
 * "> " block). Never hides everything: with nothing left above the quote, all of it shows.
 */
export function splitQuoted(body: string): SplitBody {
  const lines = body.split(/\r?\n/);
  const start = quoteStart(lines);
  if (start <= 0) return { visible: body, quoted: null };
  const visible = lines.slice(0, start).join("\n").trimEnd();
  const quoted = lines.slice(start).join("\n").trim();
  if (!visible.trim() || !quoted) return { visible: body, quoted: null };
  return { visible, quoted };
}
