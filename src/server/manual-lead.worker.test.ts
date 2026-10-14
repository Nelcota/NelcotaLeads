import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { MANUAL_SEARCH_ID } from "@/lib/searches";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakeQueue } from "../../test/fake-queue";
import { resetDb } from "../../test/reset-db";
import { createManualLead, NO_SITE_MESSAGE } from "./manual-lead";
import { processLead } from "./process-lead";
import { storeSettings, DEFAULT_SETTINGS } from "./settings-store";

const db = getDb(env.DB);

async function lead(id: string) {
  return db.query.leads.findFirst({ where: eq(leads.id, id) });
}

describe("createManualLead", () => {
  beforeEach(resetDb);

  it("saves a lead without a site as not analyzed, in the manual search", async () => {
    const { sent, queue } = createFakeQueue();
    const result = await createManualLead(db, queue, {
      name: " Padaria Sol ",
      email: "Oi@Padaria.com",
    });
    expect(result.status).toBe("created");
    expect(await lead(result.id)).toMatchObject({
      name: "Padaria Sol",
      email: "oi@padaria.com",
      searchId: MANUAL_SEARCH_ID,
      siteStatus: "none",
      analysisStatus: "skipped",
      analysisError: NO_SITE_MESSAGE,
      status: "new",
    });
    expect(sent).toEqual([]);
    expect(
      await db.query.searches.findFirst({ where: eq(searches.id, MANUAL_SEARCH_ID) }),
    ).toMatchObject({ status: "done", foundCount: 1 });
  });

  it("queues the analysis when there is a site, and the AI never discards it", async () => {
    await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites", minScore: 50 });
    const { sent, queue } = createFakeQueue();
    const { id } = await createManualLead(db, queue, {
      name: "Clínica",
      phone: "(31) 99876-5432",
      website: "clinica.com.br",
    });
    expect(sent).toEqual([{ leadId: id }]);
    expect(await lead(id)).toMatchObject({
      website: "https://clinica.com.br/",
      siteStatus: "pending",
      analysisStatus: "pending",
    });
    // Scores 10, below the minimum of 50: a searched lead would be discarded.
    await processLead(
      {
        db,
        analyzer: createFakeAnalyzer(10),
        fetchSite: async () => ({ status: "unreachable", reason: "x" }),
      },
      { leadId: id },
    );
    expect(await lead(id)).toMatchObject({ analysisStatus: "done", score: 10, status: "new" });
  });

  it("finds an existing lead by e-mail or phone instead of creating another", async () => {
    const { queue } = createFakeQueue();
    const first = await createManualLead(db, queue, {
      name: "Padaria",
      email: "oi@padaria.com",
      phone: "31 99876-5432",
    });
    expect(await createManualLead(db, queue, { name: "Outra", email: "OI@padaria.com" })).toEqual({
      status: "duplicate",
      id: first.id,
      name: "Padaria",
    });
    expect(
      await createManualLead(db, queue, { name: "Outra", phone: "+55 31 99876-5432" }),
    ).toEqual({ status: "duplicate", id: first.id, name: "Padaria" });
    expect(await db.$count(leads)).toBe(1);
  });

  it("needs a name and an e-mail or a phone", async () => {
    const { queue } = createFakeQueue();
    await expect(createManualLead(db, queue, { name: "Sem contato" })).rejects.toThrow(
      "e-mail ou um telefone",
    );
    await expect(createManualLead(db, queue, { name: " ", email: "a@b.com" })).rejects.toThrow(
      "Informe o nome",
    );
    await expect(
      createManualLead(db, queue, { name: "X", email: "a@b.com", website: "javascript:x" }),
    ).rejects.toThrow("Site inválido");
  });

  it("refuses an address that opted out", async () => {
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(leads).values({
      id: "gone",
      searchId: "s",
      placeId: "p",
      name: "Saiu",
      email: "saiu@cliente.test",
      unsubscribedAt: new Date(),
    });
    await expect(
      createManualLead(db, createFakeQueue().queue, {
        name: "Nova",
        email: "saiu@cliente.test",
      }),
    ).rejects.toThrow("pediu para não receber contato");
  });
});
