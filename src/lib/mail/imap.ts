import type { Wire } from "./wire";

export type MailboxCursor = { uidValidity: number; lastUid: number };

export type FetchedMessage = { uid: number; raw: Uint8Array; truncated: boolean };

type Response = { untagged: string[]; literals: Uint8Array[] };

/** Bytes fetched per message: enough for the text of a reply, never a whole attachment. */
export const MAX_MESSAGE_BYTES = 524_288;
// No answer we ask for carries a literal larger than the partial fetch above.
const MAX_LITERAL_BYTES = 2 * MAX_MESSAGE_BYTES;

/** A tagged NO/BAD: the server refused this command, but the session is still usable. */
class ImapCommandError extends Error {}

/** The handful of IMAP4rev1 commands needed to read new messages from INBOX. */
class ImapSession {
  private tag = 0;
  constructor(private readonly wire: Wire) {}

  async greeting() {
    const line = await this.wire.readLine();
    if (!line.startsWith("* OK")) throw new Error(`IMAP: ${line.slice(0, 200)}`);
  }

  async run(command: string): Promise<Response> {
    const tag = `a${++this.tag}`;
    await this.wire.write(`${tag} ${command}\r\n`);
    const untagged: string[] = [];
    const literals: Uint8Array[] = [];
    for (;;) {
      let line = await this.wire.readLine();
      // A line ending in {n} is followed by n raw bytes, then the rest of the line.
      for (let match = /\{(\d+)\}$/.exec(line); match; match = /\{(\d+)\}$/.exec(line)) {
        const length = Number(match[1]);
        if (length > MAX_LITERAL_BYTES) throw new Error("IMAP: resposta grande demais");
        literals.push(await this.wire.readBytes(length));
        line = `${line} ${await this.wire.readLine()}`;
      }
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) {
          // Never echo the command: LOGIN carries the password.
          throw new ImapCommandError(`IMAP: ${line.slice(tag.length + 1, 200)}`);
        }
        return { untagged, literals };
      }
      untagged.push(line);
    }
  }
}

function quote(value: string) {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

function code(lines: string[], name: string): number | undefined {
  for (const line of lines) {
    const match = new RegExp(`\\[${name} (\\d+)\\]`).exec(line);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/**
 * Raw messages that arrived after the cursor. The first run (or a mailbox whose
 * UIDVALIDITY changed) starts from now instead of importing the whole inbox.
 * BODY.PEEK keeps the messages unread in the mail app; the partial fetch
 * (<0.MAX_MESSAGE_BYTES>) caps what a huge message can cost, and `truncated`
 * says when RFC822.SIZE was larger than what came back.
 */
export async function fetchNewMessages(
  wire: Wire,
  credentials: { user: string; password: string },
  cursor: MailboxCursor,
  limit = 20,
): Promise<{ cursor: MailboxCursor; messages: FetchedMessage[] }> {
  const session = new ImapSession(wire);
  try {
    await session.greeting();
    await session.run(`LOGIN ${quote(credentials.user)} ${quote(credentials.password)}`);
    const selected = await session.run("SELECT INBOX");
    const uidValidity = code(selected.untagged, "UIDVALIDITY") ?? 0;
    const uidNext = code(selected.untagged, "UIDNEXT") ?? 1;

    // UIDVALIDITY is never 0 (RFC 3501), so 0 marks a cursor that was never set. lastUid can't
    // be that marker: an empty INBOX starts at lastUid 0, and its first message (UID 1) must be
    // read, not skipped by a second "first run".
    if (cursor.uidValidity === 0 || cursor.uidValidity !== uidValidity) {
      return { cursor: { uidValidity, lastUid: uidNext - 1 }, messages: [] };
    }

    const search = await session.run(`UID SEARCH UID ${cursor.lastUid + 1}:*`);
    const uids = search.untagged
      .filter((line) => line.startsWith("* SEARCH"))
      .flatMap((line) => line.slice("* SEARCH".length).trim().split(/\s+/))
      .map(Number)
      // "n:*" always matches the newest message, even when it is older than n.
      .filter((uid) => Number.isInteger(uid) && uid > cursor.lastUid)
      // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array from filter()
      .sort((a, b) => a - b)
      .slice(0, limit);

    const messages: FetchedMessage[] = [];
    for (const uid of uids) {
      let fetched: Response;
      try {
        fetched = await session.run(
          `UID FETCH ${uid} (RFC822.SIZE BODY.PEEK[]<0.${MAX_MESSAGE_BYTES}>)`,
        );
      } catch (error) {
        // A message the server refuses to hand over is skipped, not retried forever.
        if (error instanceof ImapCommandError) continue;
        throw error;
      }
      const raw = fetched.literals[0];
      if (!raw) continue;
      const size = Number(/RFC822\.SIZE (\d+)/.exec(fetched.untagged.join(" "))?.[1] ?? 0);
      messages.push({ uid, raw, truncated: size > raw.length });
    }
    await session.run("LOGOUT").catch(() => undefined);

    const lastUid = uids.length > 0 ? Math.max(...uids) : cursor.lastUid;
    return { cursor: { uidValidity, lastUid }, messages };
  } finally {
    await wire.close().catch(() => {});
  }
}

/** Logs in and out, to check the credentials from the settings page. */
export async function verifyImap(
  wire: Wire,
  credentials: { user: string; password: string },
): Promise<void> {
  const session = new ImapSession(wire);
  try {
    await session.greeting();
    await session.run(`LOGIN ${quote(credentials.user)} ${quote(credentials.password)}`);
    await session.run("LOGOUT").catch(() => undefined);
  } finally {
    await wire.close().catch(() => {});
  }
}
