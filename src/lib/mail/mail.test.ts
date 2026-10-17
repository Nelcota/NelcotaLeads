import { describe, expect, it } from "vitest";
import { fetchNewMessages } from "./imap";
import { buildMessage, encodeHeader } from "./mime";
import { parseEmail, writtenPart } from "./parse";
import { smtpSend } from "./smtp";
import type { Wire } from "./wire";

const encoder = new TextEncoder();

/** A scripted server: each written command is answered by `respond`. */
function fakeWire(greeting: string[], respond: (command: string) => (string | Uint8Array)[]) {
  const queue: (string | Uint8Array)[] = [...greeting];
  const written: string[] = [];
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
    close: async () => {},
  };
  return { wire, written };
}

describe("buildMessage", () => {
  it("encodes non-ASCII headers and the body, with threading and unsubscribe headers", () => {
    const message = buildMessage({
      from: { address: "eu@exemplo.com.br", name: "João" },
      to: "contato@clinica.com.br",
      subject: "Agendamento online para a clínica",
      text: "Olá, tudo bem?\nAté já.",
      messageId: "<1@exemplo.com.br>",
      inReplyTo: "<0@clinica.com.br>",
      references: ["<0@clinica.com.br>"],
      unsubscribe: "eu@exemplo.com.br",
      date: new Date("2026-10-11T12:00:00Z"),
    });
    expect(message).toContain(`From: ${encodeHeader("João")} <eu@exemplo.com.br>`);
    expect(message).toContain("Subject: =?UTF-8?B?");
    expect(message).toContain("In-Reply-To: <0@clinica.com.br>");
    expect(message).toContain("List-Unsubscribe: <mailto:eu@exemplo.com.br?subject=sair>");
    expect(message.split("\r\n\r\n")[1]?.trim()).toBe(
      btoa(String.fromCharCode(...encoder.encode("Olá, tudo bem?\r\nAté já."))),
    );
  });
});

describe("smtpSend", () => {
  it("logs in with AUTH PLAIN and delivers the message", async () => {
    const { wire, written } = fakeWire(["220 mail ready"], (command) => {
      if (command.startsWith("EHLO")) return ["250-mail", "250-AUTH LOGIN PLAIN", "250 OK"];
      if (command.startsWith("AUTH PLAIN")) return ["235 ok"];
      if (command.startsWith("MAIL FROM") || command.startsWith("RCPT TO")) return ["250 ok"];
      if (command === "DATA\r\n") return ["354 go"];
      if (command.endsWith("\r\n.\r\n")) return ["250 queued"];
      return ["221 bye"];
    });
    await smtpSend(
      wire,
      { user: "eu@x.com", password: "segredo" },
      { from: "eu@x.com", to: "a@b.com" },
      "Subject: oi\r\n\r\n.linha\r\n",
    );
    expect(written).toContain(`AUTH PLAIN ${btoa("\0eu@x.com\0segredo")}\r\n`);
    expect(written).toContain("RCPT TO:<a@b.com>\r\n");
    // Dot-stuffing protects a body line that starts with ".".
    expect(written.find((line) => line.endsWith("\r\n.\r\n"))).toContain("\r\n..linha");
  });

  it("gives up on a reply that never ends", async () => {
    const endless = Array.from({ length: 101 }, () => "250-again");
    const { wire } = fakeWire(["220 ready"], (command) =>
      command.startsWith("EHLO") ? [...endless, "250 OK"] : ["250 ok"],
    );
    await expect(
      smtpSend(wire, { user: "u", password: "p" }, { from: "u@x.com", to: "t@y.com" }, "x"),
    ).rejects.toThrow("SMTP: resposta longa demais");
  });

  it("fails with the server's message when the login is refused", async () => {
    const { wire } = fakeWire(["220 ready"], (command) =>
      command.startsWith("EHLO") ? ["250 AUTH PLAIN"] : ["535 authentication failed"],
    );
    await expect(
      smtpSend(wire, { user: "u", password: "p" }, { from: "u@x.com", to: "t@y.com" }, "x"),
    ).rejects.toThrow("SMTP login: 535 authentication failed");
  });
});

describe("fetchNewMessages", () => {
  const raw = encoder.encode("From: a@b.com\r\nSubject: Re: oi\r\n\r\nTemos interesse\r\n");

  function server() {
    return fakeWire(["* OK IMAP ready"], (command) => {
      const tag = command.split(" ")[0];
      if (command.includes("LOGIN")) return [`${tag} OK logged in`];
      if (command.includes("SELECT"))
        return ["* OK [UIDVALIDITY 7] ok", "* OK [UIDNEXT 13] ok", `${tag} OK selected`];
      if (command.includes("UID SEARCH")) return ["* SEARCH 10 12", `${tag} OK search`];
      if (command.includes("UID FETCH 12"))
        return [`* 3 FETCH (UID 12 BODY[] {${raw.length}}`, raw, ")", `${tag} OK fetch`];
      return [`${tag} OK`];
    });
  }

  it("starts from now on the first run instead of importing the inbox", async () => {
    const result = await fetchNewMessages(
      server().wire,
      { user: "u", password: "p" },
      { uidValidity: 0, lastUid: 0 },
    );
    expect(result).toEqual({ cursor: { uidValidity: 7, lastUid: 12 }, messages: [] });
  });

  it("reads the first message of a mailbox that was empty on the first run", async () => {
    const emptyAtStart = fakeWire(["* OK IMAP ready"], (command) => {
      const tag = command.split(" ")[0];
      if (command.includes("SELECT"))
        return ["* OK [UIDVALIDITY 7] ok", "* OK [UIDNEXT 1] ok", `${tag} OK selected`];
      return [`${tag} OK`];
    });
    const first = await fetchNewMessages(
      emptyAtStart.wire,
      { user: "u", password: "p" },
      { uidValidity: 0, lastUid: 0 },
    );
    expect(first.cursor).toEqual({ uidValidity: 7, lastUid: 0 });

    const oneArrived = fakeWire(["* OK IMAP ready"], (command) => {
      const tag = command.split(" ")[0];
      if (command.includes("SELECT"))
        return ["* OK [UIDVALIDITY 7] ok", "* OK [UIDNEXT 2] ok", `${tag} OK selected`];
      if (command.includes("UID SEARCH UID 1:*")) return ["* SEARCH 1", `${tag} OK search`];
      if (command.includes("UID FETCH 1 "))
        return [`* 1 FETCH (UID 1 BODY[] {${raw.length}}`, raw, ")", `${tag} OK fetch`];
      return [`${tag} OK`];
    });
    const second = await fetchNewMessages(
      oneArrived.wire,
      { user: "u", password: "p" },
      first.cursor,
    );
    expect(second.cursor).toEqual({ uidValidity: 7, lastUid: 1 });
    expect(second.messages.map((message) => message.uid)).toEqual([1]);
  });

  it("fetches only messages above the cursor, keeping them unread", async () => {
    const { wire, written } = server();
    const result = await fetchNewMessages(
      wire,
      { user: "u", password: "p" },
      { uidValidity: 7, lastUid: 10 },
    );
    expect(result.cursor).toEqual({ uidValidity: 7, lastUid: 12 });
    expect(result.messages.map((message) => message.uid)).toEqual([12]);
    expect(written.some((line) => line.includes("BODY.PEEK[]"))).toBe(true);
    expect((await parseEmail(result.messages[0].raw)).text).toBe("Temos interesse");
  });
});

describe("writtenPart", () => {
  it("keeps only what the person wrote", () => {
    expect(
      writtenPart(
        "Quanto custa?\n\nAbraço\n\nEm dom., 11 de out. de 2026 às 09:00, Eu <eu@x.com> escreveu:\n> Olá, tudo bem?",
      ),
    ).toBe("Quanto custa?\n\nAbraço");
  });

  it("keeps a reply line that only looks like a header", () => {
    const reply = "Temos interesse.\nDe: 8h às 18h atendemos no consultório.\nAna";
    expect(writtenPart(reply)).toBe(reply);
  });

  it("drops the phone signature", () => {
    expect(writtenPart("Pode ligar amanhã.\n\nEnviado do meu iPhone")).toBe("Pode ligar amanhã.");
  });
});
