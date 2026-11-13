import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test/reset-db";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { querySearchesWithStates } from "./search-states";

const search = (id: string, city: string) => ({ id, niche: "Dentistas", city, maxResults: 20 });
const lead = (id: string, searchId: string, address: string | null) => ({
  id,
  searchId,
  placeId: `place-${id}`,
  name: `Empresa ${id}`,
  address,
});

describe("querySearchesWithStates", () => {
  beforeEach(resetDb);

  it("reads the state from a lead address, else from the typed city", async () => {
    const db = getDb(env.DB);
    await db
      .insert(searches)
      .values([
        search("s-address", "Belo Horizonte"),
        search("s-city", "Curitiba"),
        search("s-unknown", "Contagem"),
      ]);
    await db
      .insert(leads)
      .values([
        lead("l1", "s-address", "R. A, 1 - Centro, Vitória - ES, 29000-000, Brasil"),
        lead("l2", "s-address", null),
        lead("l3", "s-unknown", null),
      ]);

    const rows = await querySearchesWithStates(db);
    const stateOf = Object.fromEntries(rows.map((row) => [row.id, row.state]));
    expect(stateOf).toEqual({ "s-address": "ES", "s-city": "PR", "s-unknown": null });
  });

  it("skips an address without a state when another lead has one", async () => {
    const db = getDb(env.DB);
    await db.insert(searches).values(search("s-mixed", "Contagem"));
    await db
      .insert(leads)
      .values([
        lead("m1", "s-mixed", "Av. Sem Estado, 10"),
        lead("m2", "s-mixed", "R. B, 2 - Eldorado, Contagem - MG, 32000-000, Brasil"),
      ]);

    const [row] = await querySearchesWithStates(db);
    expect(row?.state).toBe("MG");
  });

  it("counts the leads that scored high", async () => {
    const db = getDb(env.DB);
    await db.insert(searches).values([search("s-scored", "Contagem"), search("s-none", "Betim")]);
    await db
      .insert(leads)
      .values([
        { ...lead("h1", "s-scored", null), score: 80 },
        { ...lead("h2", "s-scored", null), score: 60 },
        { ...lead("h3", "s-scored", null), score: 59 },
        lead("h4", "s-scored", null),
      ]);

    const rows = await querySearchesWithStates(db);
    const countOf = Object.fromEntries(rows.map((row) => [row.id, row.highScoreCount]));
    expect(countOf).toEqual({ "s-scored": 2, "s-none": 0 });
  });
});
