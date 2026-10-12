import { safeAddress } from "./mime";
import type { Wire } from "./wire";

export type SmtpCredentials = { user: string; password: string };

type Reply = { code: number; lines: string[] };

async function readReply(wire: Wire): Promise<Reply> {
  const lines: string[] = [];
  for (;;) {
    const line = await wire.readLine();
    lines.push(line);
    // "250-..." continues a multi-line reply; "250 ..." ends it.
    if (line.length < 4 || line[3] !== "-") {
      return { code: Number(line.slice(0, 3)), lines };
    }
  }
}

async function expect(wire: Wire, accepted: number[], step: string): Promise<Reply> {
  const reply = await readReply(wire);
  if (!accepted.includes(reply.code)) {
    throw new Error(`SMTP ${step}: ${reply.lines.join(" ").slice(0, 300)}`);
  }
  return reply;
}

async function command(wire: Wire, line: string, accepted: number[], step: string) {
  await wire.write(`${line}\r\n`);
  return expect(wire, accepted, step);
}

function b64(text: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

async function login(wire: Wire, credentials: SmtpCredentials) {
  await expect(wire, [220], "saudação");
  const ehlo = await command(wire, "EHLO nelcota-leads", [250], "EHLO");
  const auth = ehlo.lines.find((line) => /AUTH/i.test(line)) ?? "";
  if (/\bPLAIN\b/i.test(auth) || !/\bLOGIN\b/i.test(auth)) {
    await command(
      wire,
      `AUTH PLAIN ${b64(`\0${credentials.user}\0${credentials.password}`)}`,
      [235],
      "login",
    );
  } else {
    await command(wire, "AUTH LOGIN", [334], "login");
    await command(wire, b64(credentials.user), [334], "login");
    await command(wire, b64(credentials.password), [235], "login");
  }
}

/** Sends one message over an already open implicit-TLS connection, then closes it. */
export async function smtpSend(
  wire: Wire,
  credentials: SmtpCredentials,
  envelope: { from: string; to: string },
  message: string,
): Promise<void> {
  try {
    // Checked before login: a CR/LF here would inject SMTP commands.
    const from = safeAddress(envelope.from, "remetente");
    const to = safeAddress(envelope.to, "destinatário");
    await login(wire, credentials);
    await command(wire, `MAIL FROM:<${from}>`, [250], "remetente");
    await command(wire, `RCPT TO:<${to}>`, [250, 251], "destinatário");
    await command(wire, "DATA", [354], "DATA");
    // Dot-stuffing: a line that starts with "." gets another one.
    const data = message.replace(/\r\n\./g, "\r\n..");
    await wire.write(`${data.endsWith("\r\n") ? data : `${data}\r\n`}.\r\n`);
    await expect(wire, [250], "envio");
    await wire.write("QUIT\r\n").catch(() => {});
  } finally {
    await wire.close().catch(() => {});
  }
}

/** Logs in and quits, to check the credentials from the settings page. */
export async function smtpVerify(wire: Wire, credentials: SmtpCredentials): Promise<void> {
  try {
    await login(wire, credentials);
    await wire.write("QUIT\r\n").catch(() => {});
  } finally {
    await wire.close().catch(() => {});
  }
}
