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
});
