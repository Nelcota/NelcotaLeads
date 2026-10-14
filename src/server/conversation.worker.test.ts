import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leads, searches, type Email } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { DAILY_LIMIT_ERROR, RETRIED_PREFIX } from "@/lib/email-errors";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakeMailer } from "../../test/fake-mailer";
import type { LeadAnalyzer } from "@/lib/ai";
import type { ReplyGuidance } from "@/lib/ai/prompts";
import {
  cancelQueuedEmail,
  closeConversation,
  conversationDraft,
  draftReplyWithAi,
  editQueuedEmail,
  UNSAFE_AI_REPLY,
  retryEmail,
  saveReplyDraft,
  undoCloseConversation,
} from "./conversation";
import { CLOSED_REASON, EMAIL_OPT_OUT, EMAIL_PROVIDER, sendDue } from "./mail-flow";
import { NO_OFFER_MESSAGE } from "./process-lead";
import { DEFAULT_SETTINGS, storeSettings } from "./settings-store";
import { reserveRequest } from "./usage";

const db = getDb(env.DB);
const FROM = "eu@exemplo.com.br";
const now = new Date("2026-10-11T12:00:00Z");

async function seed() {
  await db.insert(searches).values({ id: "s", niche: "Dentistas", city: "BH", maxResults: 2 });
  const base = { searchId: "s", siteStatus: "ok" as const, analysisStatus: "done" as const };
  await db.insert(leads).values([
    {
      ...base,
      id: "a",
      placeId: "a",
      name: "Clínica A",
      email: "contato@a.com.br",
      status: "replied",
      aiMode: false,
      handoffReason: "Pediu preço",
      followUpOn: "2026-10-15",
      lastEmailAt: now,
    },
    { ...base, id: "b", placeId: "b", name: "Clínica B", email: "contato@b.com.br" },
  ]);
}

function email(id: string, leadId: string, overrides: Partial<Email> = {}) {
  return {
    id,
    leadId,
    direction: "out" as const,
    status: "queued" as const,
    author: "ai" as const,
    fromAddress: FROM,
    toAddress: `contato@${leadId}.com.br`,
    subject: "Re: Oi",
    body: "Texto",
    ...overrides,
  };
}

const lead = (id: string) => db.query.leads.findFirst({ where: eq(leads.id, id) });
const row = (id: string) => db.query.emails.findFirst({ where: eq(emails.id, id) });
const userDrafts = async () =>
  (await db.select().from(emails).where(eq(emails.leadId, "a"))).filter(
    (item) => item.status === "draft" && item.author === "user",
  );

describe("closeConversation", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
    await db
      .insert(emails)
      .values([
        email("sent", "a", { status: "sent", sentAt: now }),
        email("queued", "a", { sendAfter: now }),
        email("sending", "a", { sendAfter: now, sentAt: now }),
        email("draft", "a", { status: "draft", author: "user" }),
        email("other", "b", { status: "draft" }),
      ]);
  });

  it("cancels pending e-mails instead of deleting them, and undo restores everything", async () => {
    const snapshot = await closeConversation(db, "a", "discarded", now);
    expect(snapshot).toEqual({
      previous: {
        status: "replied",
        aiMode: false,
        handoffReason: "Pediu preço",
        followUpOn: "2026-10-15",
      },
      cancelledIds: { queued: ["queued"], draft: ["draft"] },
    });
    expect(await lead("a")).toMatchObject({ status: "discarded", aiMode: false, followUpOn: null });
    expect(await row("queued")).toMatchObject({ status: "cancelled", error: CLOSED_REASON });
    expect(await row("draft")).toMatchObject({ status: "cancelled", error: CLOSED_REASON });
    // Already picked up by a send: left to finish.
    expect(await row("sending")).toMatchObject({ status: "queued" });
    expect(await row("other")).toMatchObject({ status: "draft" });

    await undoCloseConversation(db, "a", snapshot);
    expect(await lead("a")).toMatchObject({
      status: "replied",
      aiMode: false,
      handoffReason: "Pediu preço",
      followUpOn: "2026-10-15",
    });
    expect(await row("queued")).toMatchObject({ status: "queued", error: null });
    expect(await row("draft")).toMatchObject({ status: "draft", error: null });
  });

  it("refuses an undo carrying another lead's e-mails", async () => {
    const snapshot = await closeConversation(db, "a", "closed", now);
    await expect(
      undoCloseConversation(db, "a", {
        ...snapshot,
        cancelledIds: { ...snapshot.cancelledIds, draft: ["draft", "other"] },
      }),
    ).rejects.toThrow("não são desta conversa");
    expect(await lead("a")).toMatchObject({ status: "closed" });
    expect(await row("other")).toMatchObject({ status: "draft" });
  });

  it("refuses an undo naming a status the close could not have come from", async () => {
    const snapshot = await closeConversation(db, "a", "closed", now);
    await expect(
      undoCloseConversation(db, "a", {
        ...snapshot,
        previous: { ...snapshot.previous, status: "new", aiMode: true },
      }),
    ).rejects.toThrow("não estava nesse estado");
    expect(await lead("a")).toMatchObject({ status: "closed", aiMode: false });
  });

  it("only brings back e-mails this close cancelled", async () => {
    const snapshot = await closeConversation(db, "a", "closed", now);
    await db
      .update(emails)
      .set({ error: "Cancelado: o lead respondeu" })
      .where(eq(emails.id, "queued"));
    await undoCloseConversation(db, "a", snapshot);
    expect(await row("queued")).toMatchObject({ status: "cancelled" });
    expect(await row("draft")).toMatchObject({ status: "draft" });
  });

  it("never restores a lead that opted out in the meantime", async () => {
    const snapshot = await closeConversation(db, "a", "closed", now);
    await db.update(leads).set({ unsubscribedAt: now }).where(eq(leads.id, "a"));
    await expect(undoCloseConversation(db, "a", snapshot)).rejects.toThrow(
      "pediu para não receber contato",
    );
    expect(await lead("a")).toMatchObject({ status: "closed" });
    expect(await row("queued")).toMatchObject({ status: "cancelled" });
  });

  it("refuses to close twice or to undo an open conversation", async () => {
    const snapshot = await closeConversation(db, "a", "closed", now);
    await expect(closeConversation(db, "a", "discarded", now)).rejects.toThrow("já está encerrada");
    await undoCloseConversation(db, "a", snapshot);
    await expect(undoCloseConversation(db, "a", snapshot)).rejects.toThrow("já foi reaberta");
  });
});

describe("saveReplyDraft", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
    await db.insert(emails).values([
      email("sent", "a", { status: "sent", sentAt: now, subject: "Proposta" }),
      email("in", "a", {
        direction: "in",
        status: "received",
        author: "lead",
        messageId: "<lead@a.com.br>",
        subject: "Re: Proposta",
      }),
      email("ai-draft", "a", { status: "draft", inReplyTo: "<lead@a.com.br>" }),
    ]);
  });

  it("keeps one draft per lead, answering the last message, as typed", async () => {
    await saveReplyDraft(db, { leadId: "a", body: "Olá, ", fromAddress: FROM });
    const saved = await saveReplyDraft(db, {
      leadId: "a",
      body: "Olá, tudo bem?\n",
      fromAddress: FROM,
    });
    const drafts = await userDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id: saved?.id,
      body: "Olá, tudo bem?\n",
      inReplyTo: "<lead@a.com.br>",
      subject: "Re: Proposta",
      toAddress: "contato@a.com.br",
    });
    // The AI's draft stays, but the user's own reply is the one shown.
    const all = await db.select().from(emails).where(eq(emails.leadId, "a"));
    expect(conversationDraft(all.filter((item) => item.status === "draft"))?.id).toBe(saved?.id);
  });

  it("writes one draft when two saves race", async () => {
    await Promise.all([
      saveReplyDraft(db, { leadId: "a", body: "Primeira", fromAddress: FROM }),
      saveReplyDraft(db, { leadId: "a", body: "Segunda", fromAddress: FROM }),
    ]);
    expect(await userDrafts()).toHaveLength(1);
  });

  it("removes the draft when the text is cleared", async () => {
    await saveReplyDraft(db, { leadId: "a", body: "Rascunho", fromAddress: FROM });
    expect(await saveReplyDraft(db, { leadId: "a", body: "  ", fromAddress: FROM })).toBeNull();
    expect(await userDrafts()).toHaveLength(0);
    expect(await row("ai-draft")).toMatchObject({ status: "draft" });
  });

  it("refuses closed conversations", async () => {
    await db.update(leads).set({ status: "closed" }).where(eq(leads.id, "a"));
    await expect(
      saveReplyDraft(db, { leadId: "a", body: "Oi", fromAddress: FROM }),
    ).rejects.toThrow("encerrada");
  });
});

const queuedRows = async () =>
  (await db.select().from(emails).where(eq(emails.leadId, "a"))).filter(
    (item) => item.status === "queued",
  );

describe("retryEmail", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
    await db.insert(emails).values([
      email("failed", "a", {
        status: "failed",
        author: "ai",
        inReplyTo: "<lead@a.com.br>",
        error: "O servidor SMTP recusou o envio.",
        body: "Resposta",
      }),
    ]);
  });

  it("queues the e-mail once when two retries race, and a tick sends it once", async () => {
    const results = await Promise.allSettled([
      retryEmail(db, "failed", { fromAddress: FROM, now }),
      retryEmail(db, "failed", { fromAddress: FROM, now }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const queued = await queuedRows();
    expect(queued).toEqual([
      expect.objectContaining({
        author: "user",
        body: "Resposta",
        inReplyTo: "<lead@a.com.br>",
        toAddress: "contato@a.com.br",
        sentAt: null,
      }),
    ]);
    expect(await row("failed")).toMatchObject({
      status: "failed",
      error: `${RETRIED_PREFIX}O servidor SMTP recusou o envio.`,
    });
    await expect(retryEmail(db, "failed", { fromAddress: FROM, now })).rejects.toThrow(
      "já foi reenviado",
    );

    const { mailer, sent } = createFakeMailer();
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(1);
    expect(await sendDue({ db, mailer, limit: 30 }, now)).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it("waits for the next day when the daily limit is used up", async () => {
    await db.update(emails).set({ error: DAILY_LIMIT_ERROR }).where(eq(emails.id, "failed"));
    expect(await reserveRequest(db, EMAIL_PROVIDER, 1, now)).toBe(true);
    await retryEmail(db, "failed", { fromAddress: FROM, now });

    const { mailer, sent } = createFakeMailer();
    expect(await sendDue({ db, mailer, limit: 1 }, now)).toBe(0);
    expect(await queuedRows()).toHaveLength(1);
    const tomorrow = new Date("2026-10-12T12:00:00Z");
    expect(await sendDue({ db, mailer, limit: 1 }, tomorrow)).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("refuses leads that opted out, closed conversations and e-mails that did not fail", async () => {
    await db.update(leads).set({ unsubscribedAt: now }).where(eq(leads.id, "a"));
    await expect(retryEmail(db, "failed", { fromAddress: FROM, now })).rejects.toThrow(
      "pediu para não receber",
    );
    await db.update(leads).set({ unsubscribedAt: null, status: "closed" }).where(eq(leads.id, "a"));
    await expect(retryEmail(db, "failed", { fromAddress: FROM, now })).rejects.toThrow("Reabra");
    await db.update(emails).set({ status: "cancelled" }).where(eq(emails.id, "failed"));
    await expect(retryEmail(db, "failed", { fromAddress: FROM, now })).rejects.toThrow(
      "que falhou",
    );
    expect(await queuedRows()).toHaveLength(0);
  });
});

describe("queued e-mails", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
    await storeSettings(db, { ...DEFAULT_SETTINGS, senderName: "Ana", senderCompany: "Nelcota" });
    await db.insert(emails).values([
      email("waiting", "a", {
        sendAfter: now,
        body: ["Olá de novo.", "Ana\nNelcota", EMAIL_OPT_OUT].join("\n\n"),
      }),
      email("sending", "a", { sendAfter: now, sentAt: now }),
    ]);
  });

  it("cancels only what no send picked up yet", async () => {
    expect(await cancelQueuedEmail(db, "waiting")).toMatchObject({
      status: "cancelled",
      error: "Cancelado por você",
    });
    await expect(cancelQueuedEmail(db, "sending")).rejects.toThrow(
      "Já está saindo, não dá mais para cancelar.",
    );
    expect(await row("sending")).toMatchObject({ status: "queued" });
    await expect(cancelQueuedEmail(db, "waiting")).rejects.toThrow("não está mais na fila");
  });

  it("turns a queued e-mail into the user's draft, without signature or opt-out", async () => {
    expect(await editQueuedEmail(db, "waiting")).toMatchObject({
      status: "draft",
      author: "user",
      body: "Olá de novo.",
      sendAfter: null,
    });
    await expect(editQueuedEmail(db, "sending")).rejects.toThrow("Já está saindo");
  });

  it("never replaces a draft the user already has", async () => {
    await saveReplyDraft(db, { leadId: "a", body: "Meu texto", fromAddress: FROM });
    await expect(editQueuedEmail(db, "waiting")).rejects.toThrow("já tem uma resposta");
    expect(await row("waiting")).toMatchObject({ status: "queued" });
    expect((await userDrafts())[0]?.body).toBe("Meu texto");
  });
});

const aiDeps = (analyzer: LeadAnalyzer) => ({ db, analyzer, fromAddress: FROM });
const outgoing = async () =>
  (await db.select().from(emails).where(eq(emails.leadId, "a"))).filter(
    (item) => item.status === "queued" || item.status === "sent",
  );

describe("draftReplyWithAi", () => {
  const usage = { model: "m", tokensIn: 1, tokensOut: 1, cost: 0 };
  /** Answers with `reply` and records the guidance it was given. */
  function replying(reply: string) {
    const seen: (ReplyGuidance | undefined)[] = [];
    const analyzer: LeadAnalyzer = {
      ...createFakeAnalyzer(),
      replyEmail: async (_settings, _lead, _thread, guidance) => {
        seen.push(guidance);
        return { decision: { action: "reply", reason: "ok", reply, draft: "" }, usage };
      },
    };
    return { analyzer, seen };
  }

  beforeEach(async () => {
    await resetDb();
    await seed();
    await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites para clínicas" });
    await db.insert(emails).values([
      email("sent", "a", { status: "sent", sentAt: now, subject: "Proposta" }),
      email("in", "a", {
        direction: "in",
        status: "received",
        author: "lead",
        messageId: "<lead@a.com.br>",
        subject: "Re: Proposta",
        body: "Pode me contar mais?",
      }),
      email("ai-draft", "a", { status: "draft", inReplyTo: "<lead@a.com.br>", body: "Da IA" }),
    ]);
  });

  it("keeps the AI's answer as the user's draft and sends nothing", async () => {
    const { analyzer, seen } = replying("Claro, posso explicar em 15 minutos amanhã?");
    const sentBefore = (await outgoing()).length;
    const draft = await draftReplyWithAi(aiDeps(analyzer), { leadId: "a" });

    expect(draft).toMatchObject({
      author: "user",
      status: "draft",
      body: "Claro, posso explicar em 15 minutos amanhã?",
      inReplyTo: "<lead@a.com.br>",
    });
    expect(await userDrafts()).toHaveLength(1);
    expect(await outgoing()).toHaveLength(sentBefore);
    // Without a reply of the user's, the AI's own draft is what it rewrites.
    expect(seen).toEqual([{ instruction: undefined, draft: "Da IA" }]);
  });

  it("rewrites the reply the user is writing, with their direction", async () => {
    await saveReplyDraft(db, { leadId: "a", body: "oi, da pra falar amanha?", fromAddress: FROM });
    const { analyzer, seen } = replying("Oi! Podemos conversar amanhã?");
    await draftReplyWithAi(aiDeps(analyzer), { leadId: "a", instruction: "mais formal" });

    expect(seen).toEqual([{ instruction: "mais formal", draft: "oi, da pra falar amanha?" }]);
    const drafts = await userDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.body).toBe("Oi! Podemos conversar amanhã?");
  });

  it.each([
    ["a link", "Veja em https://exemplo.com.br"],
    ["an e-mail address", "Escreva para vendas@exemplo.com.br"],
    ["a phone", "Me ligue no (31) 99999-0000"],
    ["a price", "Custa R$ 500 por mês"],
    ["nothing", ""],
  ])("refuses an answer with %s and keeps the draft as it was", async (_name, reply) => {
    await saveReplyDraft(db, { leadId: "a", body: "Meu texto", fromAddress: FROM });
    await expect(
      draftReplyWithAi(aiDeps(replying(reply).analyzer), { leadId: "a" }),
    ).rejects.toThrow(UNSAFE_AI_REPLY);
    const drafts = await userDrafts();
    expect(drafts.map((item) => item.body)).toEqual(["Meu texto"]);
  });

  it("hides the provider's error and saves nothing", async () => {
    const failing: LeadAnalyzer = {
      ...createFakeAnalyzer(),
      replyEmail: () => Promise.reject(new Error("DeepSeek 500: internal")),
    };
    await expect(draftReplyWithAi(aiDeps(failing), { leadId: "a" })).rejects.toThrow(
      "A IA não conseguiu escrever agora. Tente de novo.",
    );
    expect(await userDrafts()).toHaveLength(0);
  });

  it("refuses closed conversations and leads without an offer set", async () => {
    const { analyzer, seen } = replying("Oi");
    await storeSettings(db, DEFAULT_SETTINGS);
    await expect(draftReplyWithAi(aiDeps(analyzer), { leadId: "a" })).rejects.toThrow(
      NO_OFFER_MESSAGE,
    );
    await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites" });
    await db.update(leads).set({ status: "closed" }).where(eq(leads.id, "a"));
    await expect(draftReplyWithAi(aiDeps(analyzer), { leadId: "a" })).rejects.toThrow("encerrada");
    expect(seen).toHaveLength(0);
  });
});
