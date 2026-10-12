import type { IncomingEmail, Mailer, OutgoingEmail } from "@/lib/mail";

/** Mailbox double (tests only): records sends and serves a scripted inbox. */
export function createFakeMailer(address = "eu@exemplo.com.br") {
  const sent: OutgoingEmail[] = [];
  const inbox: IncomingEmail[] = [];
  let fail = false;
  const mailer: Mailer = {
    address,
    send: async (email) => {
      if (fail) {
        // One-shot, like a passing server hiccup: the next send works again.
        fail = false;
        throw new Error("SMTP envio: 550 recusado");
      }
      sent.push(email);
    },
    fetchNew: async (cursor) => ({
      cursor: { uidValidity: 1, lastUid: cursor.lastUid + inbox.length },
      messages: inbox.splice(0),
    }),
    verify: async () => {},
  };
  return {
    mailer,
    sent,
    inbox,
    failNext: () => {
      fail = true;
    },
  };
}

export function incoming(overrides: Partial<IncomingEmail>): IncomingEmail {
  return {
    from: "contato@clinica.com.br",
    fromName: null,
    subject: "Re: Assunto",
    messageId: `<${crypto.randomUUID()}@clinica.com.br>`,
    inReplyTo: null,
    references: [],
    text: "Oi",
    date: null,
    automatic: false,
    ...overrides,
  };
}
