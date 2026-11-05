/**
 * What a bounce (delivery status notification) says about the e-mail that did not arrive: the
 * Message-IDs it quotes (the original's headers travel inside the report) and the recipients
 * that failed. Either may be empty: report formats vary a lot between providers.
 */
export type BounceReport = { messageIds: string[]; recipients: string[] };

// Bounds on what one report can make us look up.
const MAX_SCAN = 200_000;
const MAX_ITEMS = 10;

const MESSAGE_ID = /^<[^\s<>@]+@[^\s<>@]+>$/;
const ADDRESS = /^[^\s@<>"';,]+@[^\s@<>"';,]+\.[a-z]{2,}$/i;
const ADDRESS_IN_TEXT = /[^\s@<>"';,():[\]]+@[^\s@<>"';,():[\]]+\.[a-z]{2,}/gi;
// Lines of the original's headers and of the report itself (RFC 3464), in any case.
const MESSAGE_ID_LINE = /^message-id:[ \t]*(<[^\s<>]+>)/gim;
const RECIPIENT_LINE = /^(?:final|original)-recipient:[ \t]*rfc822;[ \t]*<?([^\s<>;]+)>?/gim;
// Report fields that say delivery failed for good: a delay ("Action: delayed", 4.x.x) is not.
const FAILED_ACTION = /^action:[ \t]*failed\b/im;
const PERMANENT_STATUS = /^status:[ \t]*5\.\d{1,3}\.\d{1,3}\b/im;
// Parts that carry the report or the original's headers.
const REPORT_PART =
  /^(message\/(delivery-status|global-delivery-status|rfc822|global-headers)|text\/rfc822-headers)$/i;

/**
 * Looks like a report sent back by a mail server, not an out-of-office or another automatic
 * reply. Only `bounceReport` decides whether delivery really failed.
 */
export function isBounce(header: (name: string) => string, from: string): boolean {
  return (
    /report-type=["']?delivery-status/i.test(header("content-type")) ||
    header("x-failed-recipients").trim() !== "" ||
    /^(mailer-daemon|postmaster)@/i.test(from)
  );
}

/** The text of the report parts, which the parser keeps as attachments. */
export function reportPartsText(
  attachments: readonly { mimeType: string; content: ArrayBuffer | Uint8Array | string }[],
): string {
  const decoder = new TextDecoder();
  return attachments
    .filter((part) => REPORT_PART.test(part.mimeType))
    .map((part) => (typeof part.content === "string" ? part.content : decoder.decode(part.content)))
    .join("\n")
    .slice(0, MAX_SCAN);
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)].slice(0, MAX_ITEMS);
}

function matches(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((match) => match[1] ?? "");
}

/** Whether the report says delivery failed for good, not that it is still being retried. */
export function reportsFailure(source: string, failedRecipients: string): boolean {
  if (failedRecipients.trim() !== "") return true;
  const scan = source.slice(0, MAX_SCAN);
  return FAILED_ACTION.test(scan) || PERMANENT_STATUS.test(scan);
}

/**
 * Reads a bounce; null when it does not say delivery failed (a delay notice, or a message from
 * postmaster@ without a report), so nothing is marked as bounced on its word. `source` is the
 * raw message plus the report parts; `ownMessageId` is the bounce's own id, which is also a
 * Message-ID line in it. The failed recipients come from the report fields and
 * X-Failed-Recipients, or else from the addresses written in its `text`.
 */
export function bounceReport({
  source,
  text,
  ownMessageId,
  failedRecipients,
  from,
}: {
  source: string;
  text: string;
  ownMessageId: string | null;
  failedRecipients: string;
  from: string;
}): BounceReport | null {
  if (!reportsFailure(source, failedRecipients)) return null;
  const scan = source.slice(0, MAX_SCAN);
  const messageIds = unique(
    matches(scan, MESSAGE_ID_LINE).filter((id) => MESSAGE_ID.test(id) && id !== ownMessageId),
  );
  const reported = [...matches(scan, RECIPIENT_LINE), ...failedRecipients.split(",")]
    .map((address) => address.trim().toLowerCase())
    .filter((address) => ADDRESS.test(address));
  const recipients =
    reported.length > 0
      ? reported
      : (text.slice(0, MAX_SCAN).match(ADDRESS_IN_TEXT) ?? [])
          .map((address) => address.toLowerCase())
          .filter((address) => address !== from);
  return { messageIds, recipients: unique(recipients) };
}
