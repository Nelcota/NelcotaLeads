import { describe, expect, it } from "vitest";
import { bounceReport, isBounce } from "./bounce";
import { parseEmail } from "./parse";

const encoder = new TextEncoder();
const headers = (values: Record<string, string>) => (name: string) => values[name] ?? "";

// A typical RFC 3464 report: a human part, the report fields and the original's headers.
const DSN = [
  "From: Mail Delivery System <MAILER-DAEMON@mx.provedor.test>",
  "To: eu@exemplo.com.br",
  "Subject: Undelivered Mail Returned to Sender",
  "Message-ID: <dsn-1@mx.provedor.test>",
  'Content-Type: multipart/report; report-type=delivery-status; boundary="b"',
  "",
  "--b",
  "Content-Type: text/plain",
  "",
  "Não foi possível entregar a mensagem para contato@clinica.com.br.",
  "--b",
  "Content-Type: message/delivery-status",
  "",
  "Reporting-MTA: dns; mx.provedor.test",
  "",
  "Final-Recipient: rfc822; Contato@Clinica.com.br",
  "Action: failed",
  "Status: 5.1.1",
  "--b",
  "Content-Type: text/rfc822-headers",
  "",
  "From: eu@exemplo.com.br",
  "To: contato@clinica.com.br",
  "Message-ID: <original-1@exemplo.com.br>",
  "Subject: Oi",
  "--b--",
  "",
].join("\r\n");

describe("isBounce", () => {
  it("tells a delivery report from other automatic mail", () => {
    const report = { "content-type": "multipart/report; report-type=delivery-status" };
    expect(isBounce(headers(report), "x@y.com")).toBe(true);
    expect(isBounce(headers({ "x-failed-recipients": "a@b.com" }), "x@y.com")).toBe(true);
    expect(isBounce(headers({}), "mailer-daemon@y.com")).toBe(true);
    expect(isBounce(headers({ "auto-submitted": "auto-replied" }), "contato@y.com")).toBe(false);
  });
});

describe("bounceReport", () => {
  it("reads the quoted Message-ID and the failed recipient, not its own id", () => {
    expect(
      bounceReport({
        source: DSN,
        text: "",
        ownMessageId: "<dsn-1@mx.provedor.test>",
        failedRecipients: "",
        from: "mailer-daemon@mx.provedor.test",
      }),
    ).toEqual({
      messageIds: ["<original-1@exemplo.com.br>"],
      recipients: ["contato@clinica.com.br"],
    });
  });

  it("uses X-Failed-Recipients, or else the addresses in the text", () => {
    const base = { source: "", ownMessageId: null, from: "mailer-daemon@x.test" };
    expect(
      bounceReport({ ...base, text: "", failedRecipients: "A@b.com, c@d.com" })?.recipients,
    ).toEqual(["a@b.com", "c@d.com"]);
    expect(
      bounceReport({
        ...base,
        source: "Status: 5.1.1",
        text: "Your message to Contato@Loja.test couldn't be delivered. mailer-daemon@x.test",
        failedRecipients: "",
      })?.recipients,
    ).toEqual(["contato@loja.test"]);
  });

  it("is not a bounce without a permanent failure", () => {
    const base = { text: "", ownMessageId: null, failedRecipients: "", from: "postmaster@x.test" };
    const delayed = DSN.replace("Action: failed", "Action: delayed").replace("5.1.1", "4.4.7");
    expect(bounceReport({ ...base, source: delayed })).toBeNull();
    // A note from postmaster@ that only answers our e-mail.
    expect(
      bounceReport({ ...base, source: "In-Reply-To: <original-1@exemplo.com.br>" }),
    ).toBeNull();
    expect(bounceReport({ ...base, source: "Action: failed" })).not.toBeNull();
  });
});

describe("parseEmail with a bounce", () => {
  it("exposes the report and marks it automatic", async () => {
    const email = await parseEmail(encoder.encode(DSN));
    expect(email.automatic).toBe(true);
    expect(email.bounce).toEqual({
      messageIds: ["<original-1@exemplo.com.br>"],
      recipients: ["contato@clinica.com.br"],
    });
  });

  it("keeps a delay notice automatic but not a bounce", async () => {
    const delayed = DSN.replace("Action: failed", "Action: delayed").replace("5.1.1", "4.4.7");
    const email = await parseEmail(encoder.encode(delayed));
    expect(email.automatic).toBe(true);
    expect(email.bounce).toBeNull();
  });

  it("keeps postmaster mail without a report automatic but not a bounce", async () => {
    const email = await parseEmail(
      encoder.encode(
        [
          "From: postmaster@mx.provedor.test",
          "Message-ID: <p@x.test>",
          "In-Reply-To: <original-1@exemplo.com.br>",
          "",
          "Recebido.",
          "",
        ].join("\r\n"),
      ),
    );
    expect(email.automatic).toBe(true);
    expect(email.bounce).toBeNull();
  });

  it("leaves ordinary mail without one", async () => {
    const email = await parseEmail(
      encoder.encode("From: a@b.com\r\nMessage-ID: <abc@b.com>\r\n\r\noi\r\n"),
    );
    expect(email.bounce).toBeNull();
  });
});
