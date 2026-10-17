import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { EMAIL_REMOVED_REASON, editLeadContact } from "./lead-edit";

const db = getDb(env.DB);

async function lead(id = "a") {
  return db.query.leads.findFirst({ where: eq(leads.id, id) });
}

describe("editLeadContact", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(leads).values([
      {
        id: "a",
        searchId: "s",
        placeId: "p1",
        name: "Padaria",
        website: "https://padaria.com.br/",
        siteStatus: "ok",
      },
      {
        id: "gone",
        searchId: "s",
        placeId: "p2",
        name: "Saiu",
        email: "saiu@cliente.test",
        unsubscribedAt: new Date(),
      },
    ]);
  });

  it("adds an e-mail, lowercase", async () => {
    await editLeadContact(db, { id: "a", field: "email", value: " Oi@Padaria.com.BR " });
    expect(await lead()).toMatchObject({ email: "oi@padaria.com.br" });
  });

  it("refuses an address that opted out, and an invalid one", async () => {
    await expect(
      editLeadContact(db, { id: "a", field: "email", value: "SAIU@cliente.test" }),
    ).rejects.toThrow("pediu para não receber contato");
    await expect(
      editLeadContact(db, { id: "a", field: "email", value: "não é e-mail" }),
    ).rejects.toThrow("E-mail inválido");
    expect(await lead()).toMatchObject({ email: null });
  });

  it("stores the phone with its E.164 form", async () => {
    await editLeadContact(db, { id: "a", field: "phone", value: "(31) 3222-1100" });
    expect(await lead()).toMatchObject({ phone: "(31) 3222-1100", phoneE164: "+553132221100" });
  });

  it("keeps the site's reading unless the site changed", async () => {
    await editLeadContact(db, { id: "a", field: "website", value: "padaria.com.br" });
    expect(await lead()).toMatchObject({ siteStatus: "ok" });
    await editLeadContact(db, { id: "a", field: "website", value: "padaria2.com.br" });
    expect(await lead()).toMatchObject({
      website: "https://padaria2.com.br/",
      siteStatus: "pending",
    });
  });

  it("renames, and rejects unknown leads", async () => {
    await editLeadContact(db, { id: "a", field: "name", value: "Padaria Sol" });
    expect(await lead()).toMatchObject({ name: "Padaria Sol" });
    await expect(editLeadContact(db, { id: "zz", field: "name", value: "X" })).rejects.toThrow(
      "Lead não encontrado",
    );
  });

  it("follows unsent e-mails stored with the address in another case", async () => {
    await db.update(leads).set({ email: "contato@loja.test" }).where(eq(leads.id, "a"));
    await db.insert(emails).values({
      id: "queued",
      leadId: "a",
      direction: "out",
      author: "user",
      status: "queued",
      fromAddress: "eu@nelcota.test",
      toAddress: "Contato@Loja.test",
      subject: "Oi",
      body: "Oi",
    });
    await editLeadContact(db, { id: "a", field: "email", value: "" });
    expect(await db.query.emails.findFirst({ where: eq(emails.id, "queued") })).toMatchObject({
      status: "cancelled",
      error: EMAIL_REMOVED_REASON,
    });
  });

  it("sends e-mails not yet sent to the corrected address, or cancels them when removed", async () => {
    await db.update(leads).set({ email: "velho@padaria.test" }).where(eq(leads.id, "a"));
    const row = {
      leadId: "a",
      direction: "out" as const,
      author: "user" as const,
      fromAddress: "eu@nelcota.test",
      toAddress: "velho@padaria.test",
      subject: "Oi",
      body: "Oi",
    };
    await db.insert(emails).values([
      { ...row, id: "draft", status: "draft" },
      { ...row, id: "queued", status: "queued" },
      { ...row, id: "sent", status: "sent", sentAt: new Date() },
    ]);
    const byId = async () =>
      Object.fromEntries(
        (await db.select().from(emails)).map((e) => [e.id, { to: e.toAddress, status: e.status }]),
      );

    await editLeadContact(db, { id: "a", field: "email", value: "Novo@Padaria.test" });
    expect(await byId()).toEqual({
      draft: { to: "novo@padaria.test", status: "draft" },
      queued: { to: "novo@padaria.test", status: "queued" },
      sent: { to: "velho@padaria.test", status: "sent" },
    });

    await editLeadContact(db, { id: "a", field: "email", value: "" });
    const rows = await db.select().from(emails);
    expect(rows.find((e) => e.id === "queued")).toMatchObject({
      status: "cancelled",
      error: EMAIL_REMOVED_REASON,
    });
    expect(rows.find((e) => e.id === "sent")).toMatchObject({ status: "sent" });
  });
});
