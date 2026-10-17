import { describe, expect, it, vi } from "vitest";
import { fetchNewMessages, MAX_MESSAGE_BYTES } from "./imap";
import { parseAll } from "./index";
import { buildMessage, type OutgoingEmail } from "./mime";
import { htmlToText, isAutomatic, parseEmail } from "./parse";
import { smtpSend } from "./smtp";
import { createWire, type Wire } from "./wire";

const encoder = new TextEncoder();

/** A scripted server, as in mail.test.ts: each written command is answered by `respond`. */
function fakeWire(greeting: string[], respond: (command: string) => (string | Uint8Array)[]) {
  const queue: (string | Uint8Array)[] = [...greeting];
  const written: string[] = [];
  let closed = false;
  const wire: Wire = {
    readLine: async () => {
      const next = queue.shift();
      if (typeof next !== "string") throw new Error(`expected a line, got ${String(next)}`);
      return next;
    },
    readBytes: async (length) => {
      const next = queue.shift();
      if (!(next instanceof Uint8Array) || next.length !== length) throw new Error("bad literal");
      return next;
    },
    write: async (text) => {
      written.push(text);
      queue.push(...respond(text));
    },
    close: async () => {
      closed = true;
    },
  };
  return { wire, written, isClosed: () => closed };
}

/** A byte stream that delivers `chunks`, then stays silent (never ends). */
function stalledStream(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
    },
  });
}

const sink = () => new WritableStream<Uint8Array>();

const base: OutgoingEmail = {
  from: { address: "eu@exemplo.com.br" },
  to: "contato@clinica.com.br",
  subject: "Oi",
  text: "Olá",
  messageId: "<1@exemplo.com.br>",
  date: new Date("2026-10-11T12:00:00Z"),
};

function headersOf(message: string) {
  return message.split("\r\n\r\n")[0] ?? "";
}

describe("wire (SEC-1, ASY-6)", () => {
  it("reads lines and literals split across many chunks", async () => {
    const payload = "x".repeat(10_000);
    const bytes = encoder.encode(`* OK hi\r\n${payload}tail\r\n`);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 7) chunks.push(bytes.subarray(i, i + 7));
    const wire = createWire(stalledStream(chunks), sink());
    expect(await wire.readLine()).toBe("* OK hi");
    expect(new TextDecoder().decode(await wire.readBytes(payload.length))).toBe(payload);
    expect(await wire.readLine()).toBe("tail");
  });

  it("times out a stalled read, closes the socket and stays failed", async () => {
    const onClose = vi.fn<() => Promise<void>>(async () => {});
    const wire = createWire(stalledStream([encoder.encode("partial")]), sink(), onClose, 20);
    await expect(wire.readLine()).rejects.toThrow("Tempo esgotado");
    expect(onClose).toHaveBeenCalledTimes(1);
    await expect(wire.write("NOOP\r\n")).rejects.toThrow("Tempo esgotado");
    await wire.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("times out a write the server never drains", async () => {
    const onClose = vi.fn<() => Promise<void>>(async () => {});
    const blocked = new WritableStream<Uint8Array>({ write: () => new Promise(() => {}) });
    const wire = createWire(stalledStream([]), blocked, onClose, 20);
    await expect(wire.write("x")).rejects.toThrow("Tempo esgotado");
    expect(onClose).toHaveBeenCalled();
  });

  it("lets a timeout reach smtpSend's finally", async () => {
    const onClose = vi.fn<() => Promise<void>>(async () => {});
    const wire = createWire(stalledStream([]), sink(), onClose, 20);
    await expect(
      smtpSend(wire, { user: "u", password: "p" }, { from: "u@x.com", to: "t@y.com" }, "x"),
    ).rejects.toThrow("Tempo esgotado");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("refuses an endless line instead of buffering it", async () => {
    const chunk = encoder.encode("a".repeat(65_536));
    const stream = new ReadableStream<Uint8Array>({
      pull: (controller) => controller.enqueue(chunk),
    });
    const wire = createWire(stream, sink());
    await expect(wire.readLine()).rejects.toThrow("Resposta inválida");
  });
});

/** An IMAP server holding UIDs 11 and 12; `refuse` makes it answer NO for 11. */
function imapServer(size: number, body: Uint8Array, refuse = false) {
  return fakeWire(["* OK IMAP ready"], (command) => {
    const tag = command.split(" ")[0];
    if (command.includes("LOGIN")) return [`${tag} OK logged in`];
    if (command.includes("SELECT"))
      return ["* OK [UIDVALIDITY 7] ok", "* OK [UIDNEXT 13] ok", `${tag} OK selected`];
    if (command.includes("UID SEARCH")) return ["* SEARCH 11 12", `${tag} OK search`];
    if (command.includes("UID FETCH 11") && refuse) return [`${tag} NO message gone`];
    if (command.includes("UID FETCH"))
      return [
        `* 1 FETCH (UID 12 RFC822.SIZE ${size} BODY[]<0> {${body.length}}`,
        body,
        ")",
        `${tag} OK fetch`,
      ];
    return [`${tag} OK`];
  });
}

describe("fetchNewMessages size cap (SEC-1)", () => {
  it("asks for a bounded prefix and flags a truncated message", async () => {
    const body = encoder.encode("Subject: grande\r\n\r\nolá\r\n");
    const { wire, written } = imapServer(25_000_000, body);
    const result = await fetchNewMessages(
      wire,
      { user: "u", password: "p" },
      { uidValidity: 7, lastUid: 10 },
    );
    expect(written.some((line) => line.includes(`BODY.PEEK[]<0.${MAX_MESSAGE_BYTES}>`))).toBe(true);
    expect(written.some((line) => /BODY\.PEEK\[\]\s/.test(line))).toBe(false);
    expect(result.messages.every((message) => message.truncated)).toBe(true);
  });

  it("skips a message the server refuses and still advances the cursor", async () => {
    const body = encoder.encode("Subject: oi\r\n\r\noi\r\n");
    const { wire } = imapServer(body.length, body, true);
    const result = await fetchNewMessages(
      wire,
      { user: "u", password: "p" },
      { uidValidity: 7, lastUid: 10 },
    );
    expect(result.cursor.lastUid).toBe(12);
    expect(result.messages.map((message) => [message.uid, message.truncated])).toEqual([
      [12, false],
    ]);
  });

  it("refuses a literal far larger than what was asked for", async () => {
    const { wire, isClosed } = fakeWire(["* OK IMAP ready"], (command) => {
      const tag = command.split(" ")[0];
      if (command.includes("SELECT"))
        return ["* OK [UIDVALIDITY 7] ok", "* OK [UIDNEXT 13] ok", `${tag} OK selected`];
      if (command.includes("UID SEARCH")) return ["* SEARCH 12", `${tag} OK search`];
      if (command.includes("UID FETCH")) return [`* 1 FETCH (UID 12 BODY[]<0> {99999999}`];
      return [`${tag} OK`];
    });
    await expect(
      fetchNewMessages(wire, { user: "u", password: "p" }, { uidValidity: 7, lastUid: 10 }),
    ).rejects.toThrow("grande demais");
    expect(isClosed()).toBe(true);
  });
});

describe("parseAll (ASY-13)", () => {
  it("skips a message that fails to parse and keeps the rest", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const good = encoder.encode("From: a@b.com\r\nSubject: oi\r\n\r\nTemos interesse\r\n");
    // A Uint8Array-like whose bytes cannot be read makes postal-mime throw.
    const bad = new Proxy(new Uint8Array(4), {
      get() {
        throw new Error("boom");
      },
    });
    const messages = await parseAll([
      { uid: 1, raw: bad },
      { uid: 2, raw: good },
    ]);
    expect(messages.map((message) => message.subject)).toEqual(["oi"]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe("header injection (SEC-9)", () => {
  const payload = "foo@x.com\r\nBcc: x@y.com";

  it.each([
    ["To", { to: payload }],
    ["From", { from: { address: payload } }],
    ["In-Reply-To", { inReplyTo: "<a@b>\r\nBcc: x@y.com" }],
    ["Message-ID", { messageId: "<a@b>\nBcc: x@y.com" }],
    ["List-Unsubscribe", { unsubscribe: "a@b.com\0" }],
  ])("rejects CR/LF/NUL in %s", (_, override) => {
    expect(() => buildMessage({ ...base, ...override })).toThrow(/inválido/);
  });

  it("rejects a malformed Message-ID or To address", () => {
    expect(() => buildMessage({ ...base, messageId: "sem-colchetes@x" })).toThrow("Message-ID");
    expect(() => buildMessage({ ...base, to: "Fulano <a@b.com>" })).toThrow(
      "Endereço de e-mail inválido",
    );
  });

  it("keeps CR/LF in the subject and the sender name inside an encoded-word", () => {
    const message = buildMessage({
      ...base,
      subject: "oi\r\nBcc: x@y.com",
      from: { address: "eu@exemplo.com.br", name: "Eu\r\nBcc: x@y.com" },
    });
    expect(headersOf(message)).not.toMatch(/^Bcc:/m);
  });

  it("drops invalid references, keeps the last 10 and folds the header", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `<${"r".repeat(240)}${i}@x>`);
    const message = buildMessage({
      ...base,
      inReplyTo: "not-an-id",
      references: ["<bad\r\nBcc: x@y.com>", "<a b@c>", `<${"z".repeat(300)}@x>`, ...ids],
    });
    const headers = headersOf(message);
    expect(headers).not.toContain("In-Reply-To");
    expect(headers).not.toMatch(/^Bcc:/m);
    for (const id of ids.slice(-10)) expect(headers).toContain(id);
    expect(headers).not.toContain(ids[4]);
    for (const line of headers.split("\r\n")) expect(line.length).toBeLessThanOrEqual(998);
  });

  it("refuses an injected SMTP envelope before logging in", async () => {
    const { wire, written, isClosed } = fakeWire(["220 ready"], () => ["250 ok"]);
    await expect(
      smtpSend(wire, { user: "u", password: "p" }, { from: "u@x.com", to: payload }, "x"),
    ).rejects.toThrow(/inválido/);
    expect(written).toEqual([]);
    expect(isClosed()).toBe(true);
  });
});

const headers = (values: Record<string, string>) => (name: string) => values[name] ?? "";

describe("isAutomatic (SEC-10)", () => {
  it.each([
    [{ "auto-submitted": "auto-replied" }, "a@b.com", true],
    [{ "auto-submitted": "auto-generated" }, "a@b.com", true],
    [{ "auto-submitted": "auto-notified" }, "a@b.com", true],
    [{ "auto-submitted": "no" }, "a@b.com", false],
    [{ "x-autorespond": "yes" }, "a@b.com", true],
    [{ "x-autoreply": "yes" }, "a@b.com", true],
    [{ "x-auto-response-suppress": "All" }, "a@b.com", false],
    [{ "content-type": "multipart/report; report-type=delivery-status" }, "a@b.com", true],
    [{ precedence: "bulk" }, "a@b.com", true],
    [{}, "noreply@b.com", true],
    [{}, "no-reply@b.com", true],
    [{}, "bounces+123@b.com", true],
    [{}, "mailer-daemon@b.com", true],
    [{}, "postmaster@b.com", true],
    [{}, "contato@b.com", false],
    [{ "content-type": "text/plain" }, "noreplyhero@b.com", false],
  ])("%j from %s -> %s", (values, from, expected) => {
    expect(isAutomatic(headers(values), from)).toBe(expected);
  });

  it("flags a delivery status notification end to end", async () => {
    const raw = encoder.encode(
      'From: MAILER-DAEMON@x.com\r\nContent-Type: multipart/report; report-type=delivery-status; boundary="b"\r\n\r\n--b\r\nContent-Type: text/plain\r\n\r\nfalhou\r\n--b--\r\n',
    );
    expect((await parseEmail(raw)).automatic).toBe(true);
  });
});

describe("parseEmail bounds (VAL-2)", () => {
  it("caps the subject and text, and keeps only well-formed ids", async () => {
    const references = [
      "<bad id>",
      "nobrackets@x",
      ...Array.from({ length: 60 }, (_, i) => `<r${i}@x.com>`),
    ];
    const raw = encoder.encode(
      [
        "From: a@b.com",
        `Subject: ${"s".repeat(1000)}`,
        `Message-ID: <${"m".repeat(1000)}@x.com>`,
        "In-Reply-To: <orig@exemplo.com.br> (comentário)",
        `References: ${references.join(" ")}`,
        "Date: isto não é uma data",
        "",
        "x".repeat(100_000),
        "",
      ].join("\r\n"),
    );
    const email = await parseEmail(raw);
    expect(email.subject).toHaveLength(300);
    expect(email.messageId).toBeNull();
    expect(email.inReplyTo).toBe("<orig@exemplo.com.br>");
    expect(email.references).toHaveLength(50);
    expect(email.references.at(-1)).toBe("<r59@x.com>");
    expect(email.references.every((id) => /^<[^\s<>@]+@[^\s<>@]+>$/.test(id))).toBe(true);
    expect(email.text.length).toBeLessThanOrEqual(8000);
    expect(email.date).toBeNull();
  });

  it("keeps a valid date and Message-ID", async () => {
    const email = await parseEmail(
      encoder.encode(
        "From: a@b.com\r\nMessage-ID: <abc@b.com>\r\nDate: Sun, 11 Oct 2026 12:00:00 +0000\r\n\r\noi\r\n",
      ),
    );
    expect(email.messageId).toBe("<abc@b.com>");
    expect(email.date?.toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });
});

describe("htmlToText (hostile HTML-only e-mails)", () => {
  it("strips tags and keeps the text", () => {
    expect(htmlToText("<p>Oi<br/>tudo bem?</p><div>Sim</div>")).toBe("Oi\ntudo bem?\nSim\n");
  });

  it("stays linear on unclosed tags (was quadratic: 200 KB took tens of seconds)", () => {
    for (const hostile of ["<br".repeat(66_000), "<".repeat(200_000), "<a ".repeat(66_000)]) {
      const started = performance.now();
      htmlToText(hostile);
      expect(performance.now() - started).toBeLessThan(500);
    }
  });
});
