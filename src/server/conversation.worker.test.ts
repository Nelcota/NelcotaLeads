import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leads, searches, type Email } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { closeConversation, undoCloseConversation } from "./conversation";
import { CLOSED_REASON } from "./mail-flow";

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
