import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { analyses, emails, leads, searches, settings as settingsTable } from "@/db/schema";
import type { LeadAnalyzer } from "@/lib/ai";
import type { IncomingEmail } from "@/lib/mail";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakeMailer, incoming } from "../../test/fake-mailer";
import { resetDb } from "../../test/reset-db";
import {
  autoDispatch,
  EMAIL_OPT_OUT,
  ensureOptOut,
  EMAIL_PROVIDER,
  handleInbound,
  isUnsubscribeRequest,
  outgoingIssues,
  pollInbox,
  prepareDrafts,
  queueDrafts,
  queueFollowUps,
  sendDue,
} from "./mail-flow";
import { DEFAULT_SETTINGS, storeSettings } from "./settings-store";
import { requestsToday } from "./usage";

const db = getDb(env.DB);
const analyzer = createFakeAnalyzer();
const FROM = "eu@exemplo.com.br";

async function seed() {
  await storeSettings(db, {
    ...DEFAULT_SETTINGS,
    offer: "Sites para clínicas",
    senderName: "Ana",
  });
  await db.insert(searches).values({ id: "s", niche: "Dentistas", city: "BH", maxResults: 2 });
  const base = { searchId: "s", siteStatus: "ok" as const, analysisStatus: "done" as const };
  await db.insert(leads).values([
    { ...base, id: "a", placeId: "a", name: "Clínica A", email: "contato@clinica.com.br" },
    { ...base, id: "b", placeId: "b", name: "Clínica B" },
  ]);
  const analysis = {
    summary: "x",
    signals: [],
    painPoints: [],
    score: 50,
    scoreReasoning: "x",
    model: "m",
  };
  await db.insert(analyses).values([
    { ...analysis, id: "an-a", leadId: "a" },
    { ...analysis, id: "an-b", leadId: "b" },
  ]);
}

const lead = (id: string) => db.query.leads.findFirst({ where: eq(leads.id, id) });
const at = (time: string) => new Date(`2026-10-11T${time}:00Z`);
const leadEmails = (id: string) => db.select().from(emails).where(eq(emails.leadId, id));

async function sentFirstEmail() {
  const { drafts } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
  const now = new Date("2026-10-11T12:00:00Z");
  await queueDrafts(
    db,
    drafts.map((d) => d.id),
    now,
  );
  const fake = createFakeMailer();
  await sendDue({ db, mailer: fake.mailer, limit: 30 }, now);
  const [first] = await leadEmails("a");
  return { ...fake, messageId: first?.messageId ?? "" };
}

describe("e-mail outreach", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  it("drafts only for leads with an e-mail, signed and with the opt-out line", async () => {
    const { drafts, skipped } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, [
      "a",
      "b",
    ]);
    expect(skipped).toEqual([{ leadId: "b", name: "Clínica B", reason: "sem e-mail no site" }]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.body).toBe(`Olá, tudo bem? Texto para Clínica A.\n\nAna\n\n${EMAIL_OPT_OUT}`);
    // A second call reuses the draft instead of paying for a new one.
    const again = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
    expect(again.drafts[0]?.id).toBe(drafts[0]?.id);
  });

  it("sends queued e-mails one per tick, within the daily limit, and marks the lead contacted", async () => {
    const { drafts } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
    const now = new Date("2026-10-11T12:00:00Z");
    expect(
      await queueDrafts(
        db,
        drafts.map((d) => d.id),
        now,
      ),
    ).toBe(1);

    const { mailer, sent } = createFakeMailer();
    expect(await sendDue({ db, mailer, limit: 0 }, now)).toBe(0);
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(1);
    expect(sent[0]).toMatchObject({ to: "contato@clinica.com.br", unsubscribe: FROM });
    expect(await lead("a")).toMatchObject({ status: "contacted", followUpOn: "2026-10-14" });
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(0);
  });

  it("lets the AI answer a simple reply in the same thread", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    const now = new Date("2026-10-11T13:00:00Z");
    await handleInbound(
      { db, mailer, analyzer },
      incoming({ inReplyTo: messageId, text: "Pode explicar melhor?" }),
      now,
    );
    expect(await lead("a")).toMatchObject({ status: "replied", aiMode: true });
    const reply = (await leadEmails("a")).find((e) => e.author === "ai" && e.status === "queued");
    expect(reply).toMatchObject({ subject: "Re: Assunto", body: "Resposta da IA\n\nAna" });
  });

  it("hands the conversation over when the lead asks for a price", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    await handleInbound(
      { db, mailer, analyzer },
      incoming({ inReplyTo: messageId, text: "Quanto custa?" }),
    );
    expect(await lead("a")).toMatchObject({ aiMode: false, handoffReason: "Teste: handoff" });
    expect(
      (await leadEmails("a")).some((e) => e.status === "draft" && e.body === "Rascunho para você"),
    ).toBe(true);
  });

  it("stops for good when the lead asks to leave", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    await handleInbound({ db, mailer, analyzer }, incoming({ inReplyTo: messageId, text: "sair" }));
    const after = await lead("a");
    expect(after?.unsubscribedAt).toBeInstanceOf(Date);
    expect(after).toMatchObject({ status: "discarded", aiMode: false });
  });

  it("does not act on an opt-out matched by the sender address alone", async () => {
    const { mailer } = await sentFirstEmail();
    await handleInbound({ db, mailer, analyzer }, incoming({ text: "sair" }));
    const after = await lead("a");
    expect(after?.unsubscribedAt).toBeNull();
    expect(after).toMatchObject({ status: "replied", aiMode: false });
    expect(after?.handoffReason).toContain("Pediu para sair");
  });

  it("hands a truncated reply to a person instead of the AI", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    await handleInbound(
      { db, mailer, analyzer },
      incoming({ inReplyTo: messageId, text: "Pode explicar", truncated: true }),
    );
    expect(await lead("a")).toMatchObject({ status: "replied", aiMode: false });
    expect((await leadEmails("a")).filter((e) => e.direction === "out")).toHaveLength(1);
  });

  it("ignores auto-replies and mail from unknown senders", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    expect(await handleInbound({ db, mailer, analyzer }, incoming({ from: "outro@x.com" }))).toBe(
      false,
    );
    await handleInbound(
      { db, mailer, analyzer },
      incoming({ inReplyTo: messageId, automatic: true }),
    );
    expect(await lead("a")).toMatchObject({ status: "contacted", aiMode: true });
  });

  it("queues one follow-up in the thread when there is no answer", async () => {
    await sentFirstEmail();
    const later = new Date("2026-10-14T12:00:00Z");
    expect(await queueFollowUps({ db, analyzer, fromAddress: FROM }, later)).toBe(1);
    expect(await queueFollowUps({ db, analyzer, fromAddress: FROM }, later)).toBe(0);
    const followUp = (await leadEmails("a")).find((e) => e.status === "queued");
    expect(followUp?.subject).toBe("Re: Assunto para Clínica A");
    expect(await lead("a")).toMatchObject({ emailFollowUps: 1, followUpOn: null });
  });

  it("sends a queued e-mail once when runs race for it", async () => {
    const { drafts } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
    const now = new Date("2026-10-11T12:00:00Z");
    await queueDrafts(
      db,
      drafts.map((d) => d.id),
      now,
    );
    const { mailer, sent } = createFakeMailer();
    const results = await Promise.all([
      sendDue({ db, mailer, limit: 30 }, now),
      sendDue({ db, mailer, limit: 30 }, now),
      sendDue({ db, mailer, limit: 30 }, now),
    ]);
    expect(sent).toHaveLength(1);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await requestsToday(db, EMAIL_PROVIDER, now)).toBe(1);
  });

  it("takes over a claim left by a crashed send only after the timeout", async () => {
    const { drafts } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
    const now = new Date("2026-10-11T12:00:00Z");
    await queueDrafts(
      db,
      drafts.map((d) => d.id),
      now,
    );
    const id = drafts[0]?.id ?? "";
    const { mailer, sent } = createFakeMailer();
    const claimedAt = (minutesAgo: number) =>
      db
        .update(emails)
        .set({ sentAt: new Date(now.getTime() - minutesAgo * 60_000) })
        .where(eq(emails.id, id));
    await claimedAt(1);
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(0);
    await claimedAt(11);
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("keeps the gap after the last sent e-mail, except for answers to the lead", async () => {
    await db.insert(leads).values({
      id: "c",
      searchId: "s",
      placeId: "c",
      name: "Clínica C",
      email: "c@clinica.com.br",
      siteStatus: "ok",
      analysisStatus: "done",
    });
    await db.insert(analyses).values({
      id: "an-c",
      leadId: "c",
      summary: "x",
      signals: [],
      painPoints: [],
      score: 50,
      scoreReasoning: "x",
      model: "m",
    });
    const { mailer, sent } = await sentFirstEmail();
    // A cold e-mail due right away still waits for the gap after the one sent at 12:00.
    const { drafts } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["c"]);
    await db
      .update(emails)
      .set({ status: "queued", sendAfter: at("12:01") })
      .where(eq(emails.id, drafts[0]?.id ?? ""));
    expect(await sendDue({ db, mailer, limit: 30 }, at("12:01"))).toBe(0);
    // An answer to a message the lead sent goes out anyway.
    await db.insert(emails).values({
      id: "reply",
      leadId: "a",
      direction: "out",
      status: "queued",
      author: "ai",
      fromAddress: FROM,
      toAddress: "contato@clinica.com.br",
      subject: "Re: x",
      body: "Oi",
      inReplyTo: "<lead@clinica.com.br>",
      sendAfter: at("12:01"),
    });
    expect(await sendDue({ db, mailer, limit: 30 }, at("12:01"))).toBe(1);
    expect(sent.at(-1)?.to).toBe("contato@clinica.com.br");
    expect(await sendDue({ db, mailer, limit: 30 }, at("12:05"))).toBe(0);
    expect(await sendDue({ db, mailer, limit: 30 }, at("12:10"))).toBe(1);
    expect(sent.at(-1)?.to).toBe("c@clinica.com.br");
  });

  it("gives the daily slot back when SMTP fails, with a fixed error", async () => {
    const { drafts } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
    const now = new Date("2026-10-11T12:00:00Z");
    await queueDrafts(
      db,
      drafts.map((d) => d.id),
      now,
    );
    const { mailer, failNext } = createFakeMailer();
    failNext();
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(0);
    expect(await requestsToday(db, EMAIL_PROVIDER, now)).toBe(0);
    const [row] = await leadEmails("a");
    expect(row).toMatchObject({ status: "failed", error: "O servidor SMTP recusou o envio." });
  });

  it("does not send AI e-mails once the conversation is with the user", async () => {
    const { mailer, sent } = await sentFirstEmail();
    await db.update(leads).set({ aiMode: false }).where(eq(leads.id, "a"));
    const now = new Date("2026-10-11T13:00:00Z");
    await db.insert(emails).values({
      id: "ai-row",
      leadId: "a",
      direction: "out",
      status: "queued",
      author: "ai",
      fromAddress: FROM,
      toAddress: "contato@clinica.com.br",
      subject: "Re: x",
      body: "Oi",
      sendAfter: now,
    });
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(0);
    expect(sent).toHaveLength(1);
    expect((await leadEmails("a")).find((e) => e.id === "ai-row")?.status).toBe("failed");
  });

  it("blocks drafts to an address that opted out on another lead", async () => {
    await db.insert(leads).values({
      id: "dup",
      searchId: "s",
      placeId: "dup",
      name: "Clínica A (filial)",
      email: "CONTATO@clinica.com.br",
      unsubscribedAt: new Date(),
      status: "discarded",
    });
    const { drafts, skipped } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
    expect(drafts).toEqual([]);
    expect(skipped[0]?.reason).toBe("pediu para não receber");
  });

  it("drafts only for new leads", async () => {
    await db.update(leads).set({ status: "discarded" }).where(eq(leads.id, "a"));
    const { drafts, skipped } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]);
    expect(drafts).toEqual([]);
    expect(skipped[0]?.reason).toBe("não está mais como novo");
  });

  it("writes one draft when two prepares race", async () => {
    await Promise.all([
      prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]),
      prepareDrafts({ db, analyzer, fromAddress: FROM }, ["a"]),
    ]);
    expect(await leadEmails("a")).toHaveLength(1);
  });

  it("queues one follow-up when two ticks race, and frees the lead if the AI fails", async () => {
    await sentFirstEmail();
    const later = new Date("2026-10-14T12:00:00Z");
    const counts = await Promise.all([
      queueFollowUps({ db, analyzer, fromAddress: FROM }, later),
      queueFollowUps({ db, analyzer, fromAddress: FROM }, later),
    ]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    expect((await leadEmails("a")).filter((e) => e.status === "queued")).toHaveLength(1);

    await resetDb();
    await seed();
    await sentFirstEmail();
    const failing: LeadAnalyzer = {
      ...analyzer,
      writeFollowUp: async () => {
        throw new Error("timeout");
      },
    };
    expect(await queueFollowUps({ db, analyzer: failing, fromAddress: FROM }, later)).toBe(0);
    expect(await lead("a")).toMatchObject({ emailFollowUps: 0 });
  });

  it("stores a reply read twice only once", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    const message = incoming({ inReplyTo: messageId, text: "Pode explicar melhor?" });
    const results = await Promise.all([
      handleInbound({ db, mailer, analyzer }, message),
      handleInbound({ db, mailer, analyzer }, message),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const rows = await leadEmails("a");
    expect(rows.filter((e) => e.direction === "in")).toHaveLength(1);
    expect(rows.filter((e) => e.author === "ai" && e.status === "queued")).toHaveLength(1);
  });

  it("cancels the queued follow-up when the lead answers", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    await queueFollowUps({ db, analyzer, fromAddress: FROM }, new Date("2026-10-14T12:00:00Z"));
    await handleInbound(
      { db, mailer, analyzer },
      incoming({ inReplyTo: messageId, text: "Quanto custa?" }),
    );
    const followUp = (await leadEmails("a")).find((e) => e.body.startsWith("Lembrete"));
    expect(followUp).toMatchObject({ status: "failed", error: "Cancelado: o lead respondeu" });
  });

  it("hands off a reply matched only by the From address", async () => {
    const { mailer } = await sentFirstEmail();
    expect(
      await handleInbound(
        { db, mailer, analyzer },
        incoming({ from: "Contato@Clinica.com.br", text: "Pode explicar melhor?" }),
      ),
    ).toBe(true);
    expect(await lead("a")).toMatchObject({ status: "replied", aiMode: false });
    expect((await leadEmails("a")).some((e) => e.author === "ai" && e.status === "queued")).toBe(
      false,
    );
  });

  it("leaves AI replies with links or prices for review", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    const risky: LeadAnalyzer = {
      ...analyzer,
      replyEmail: async () => ({
        decision: {
          action: "reply",
          reason: "x",
          reply: "Veja em www.exemplo.com, sai por R$ 500.",
          draft: "",
        },
        usage: { model: "m", tokensIn: 1, tokensOut: 1, cost: 0 },
      }),
    };
    await handleInbound(
      { db, mailer, analyzer: risky },
      incoming({ inReplyTo: messageId, text: "Como funciona?" }),
    );
    expect(await lead("a")).toMatchObject({ aiMode: false });
    const rows = await leadEmails("a");
    expect(rows.some((e) => e.author === "ai" && e.status === "queued")).toBe(false);
    expect(rows.find((e) => e.status === "draft")?.body).toContain("www.exemplo.com");
  });

  it("treats an AI close that is an opt-out as an unsubscribe", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    const closing: LeadAnalyzer = {
      ...analyzer,
      replyEmail: async () => ({
        decision: {
          action: "close",
          reason: "A empresa não quer mais receber contato",
          reply: "",
          draft: "",
        },
        usage: { model: "m", tokensIn: 1, tokensOut: 1, cost: 0 },
      }),
    };
    await handleInbound(
      { db, mailer, analyzer: closing },
      incoming({ inReplyTo: messageId, text: "Agradeço, mas dispenso esse tipo de contato." }),
    );
    expect((await lead("a"))?.unsubscribedAt).toBeInstanceOf(Date);
  });

  it("keeps an opted-out lead closed when it writes again", async () => {
    const { mailer, messageId } = await sentFirstEmail();
    await handleInbound({ db, mailer, analyzer }, incoming({ inReplyTo: messageId, text: "sair" }));
    await handleInbound(
      { db, mailer, analyzer },
      incoming({ inReplyTo: messageId, text: "Obrigado!" }),
    );
    expect(await lead("a")).toMatchObject({ status: "discarded", aiMode: false });
  });

  it("handles the other messages when one of them fails", async () => {
    const { mailer, inbox, messageId } = await sentFirstEmail();
    const broken: IncomingEmail = incoming({ inReplyTo: messageId });
    Object.defineProperty(broken, "text", {
      get() {
        throw new Error("unparsable");
      },
    });
    inbox.push(broken, incoming({ inReplyTo: messageId, text: "Pode explicar melhor?" }));
    expect(await pollInbox({ db, mailer, analyzer })).toBe(1);
    expect((await db.query.settings.findFirst())?.mailLastUid).toBe(2);
  });

  it("auto-dispatch leaves drafts with risky content for review", async () => {
    await db.update(settingsTable).set({ autoDispatch: true });
    const pricey: LeadAnalyzer = {
      ...analyzer,
      writeEmail: async () => ({
        email: { subject: "Oi", body: "Sites a partir de R$ 900." },
        usage: { model: "m", tokensIn: 1, tokensOut: 1, cost: 0 },
      }),
    };
    expect(await autoDispatch({ db, analyzer: pricey, fromAddress: FROM, limit: 30 })).toBe(0);
    expect((await leadEmails("a")).map((e) => e.status)).toEqual(["draft"]);
  });

  it("auto-dispatch moves past a draft held for review", async () => {
    await db.update(settingsTable).set({ autoDispatch: true });
    await db.update(leads).set({ email: "oi@clinicab.com.br", score: 10 }).where(eq(leads.id, "b"));
    await db.update(leads).set({ score: 90 }).where(eq(leads.id, "a"));
    await db.insert(emails).values({
      id: "held",
      leadId: "a",
      direction: "out",
      status: "draft",
      author: "ai",
      fromAddress: FROM,
      toAddress: "contato@clinica.com.br",
      subject: "Oi",
      body: "Sites a partir de R$ 900.",
    });
    expect(await autoDispatch({ db, analyzer, fromAddress: FROM, limit: 1 })).toBe(1);
    expect((await leadEmails("b")).map((e) => e.status)).toEqual(["queued"]);
  });
});

describe("isUnsubscribeRequest", () => {
  const optOuts = [
    "sair",
    "SAIR",
    "Sair.",
    "sair por favor",
    "Quero sair",
    "quero sair da lista",
    "Por favor me removam",
    "Me remova da lista, obrigado",
    "Não quero mais receber e-mails",
    "nao quero receber",
    "Parem de me enviar e-mails",
    "descadastrar",
    "Como faço para me descadastrar?",
    "Unsubscribe",
    "STOP",
    "sair\n\nAtt,\nJoão Silva\nClínica X",
  ];
  const notOptOuts = [
    "Parar de perder clientes, quanto custa?",
    "Sairá caro?",
    "Não quero sair do meu plano atual, mas me conta mais.",
    "Pode explicar melhor?",
    'Gostaria de saber mais.\n\n> Para não receber mais e-mails, responda com "sair".',
    "Em seg., 12 de out. de 2026, Ana escreveu:\n> sair",
    "Hoje usamos outro sistema e queremos parar de perder agendamentos, por favor não me remova da conversa ainda",
  ];
  it.each(optOuts)("opts out: %s", (text) => {
    expect(isUnsubscribeRequest(text)).toBe(true);
  });
  it.each(notOptOuts)("keeps talking: %s", (text) => {
    expect(isUnsubscribeRequest(text)).toBe(false);
  });
  it("reads the subject when the body is empty", () => {
    expect(isUnsubscribeRequest("", "Re: sair")).toBe(true);
    expect(isUnsubscribeRequest("", "Re: Assunto para Clínica A")).toBe(false);
  });
});

describe("outgoingIssues", () => {
  it("flags links, addresses, phones, prices and long text", () => {
    expect(outgoingIssues("Podemos conversar 15 minutos amanhã?")).toEqual([]);
    expect(outgoingIssues("Veja https://x.com")).toEqual(["link"]);
    expect(outgoingIssues("Escreva para ana@x.com.br")).toEqual(["endereço de e-mail"]);
    expect(outgoingIssues("Ligue (31) 99876-5432")).toEqual(["telefone"]);
    expect(outgoingIssues("O valor é baixo")).toEqual(["preço ou valor"]);
    expect(outgoingIssues("a".repeat(1300))).toEqual(["texto longo demais"]);
  });
});

describe("ensureOptOut", () => {
  it("adds the opt-out line to a rewritten cold e-mail once", () => {
    const body = ensureOptOut("Texto todo reescrito.");
    expect(body.endsWith(EMAIL_OPT_OUT)).toBe(true);
    expect(ensureOptOut(body)).toBe(body);
  });
});
