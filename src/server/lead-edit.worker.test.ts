import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { editLeadContact } from "./lead-edit";

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
});
