import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { analyses, emails, leads, searches } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakeMailer, incoming } from "../../test/fake-mailer";
import { resetDb } from "../../test/reset-db";
import {
  EMAIL_OPT_OUT,
  handleInbound,
  prepareDrafts,
  queueDrafts,
  queueFollowUps,
  sendDue,
} from "./mail-flow";
import { DEFAULT_SETTINGS, storeSettings } from "./settings-store";

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
});
