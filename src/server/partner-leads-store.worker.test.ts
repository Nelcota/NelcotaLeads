import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches, users } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { partnerLeadsInProgress } from "./partner-leads-store";

const db = getDb(env.DB);
// Thursday 12/11/2026, 15:00 in Brazil.
const now = new Date("2026-11-12T18:00:00Z");

type Seed = { id: string; status: "new" | "contacted" | "replied" | "closed"; followUpOn?: string };

const lead = ({ id, status, followUpOn }: Seed, ownerId = "u1") => ({
  id,
  placeId: id,
  name: id,
  searchId: "s",
  ownerId,
  status,
  followUpOn: followUpOn ?? null,
});

describe("Em andamento in a partner's profile", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(users).values([
      { id: "u1", name: "Haniel", email: "haniel@nelcota.test", passwordHash: "x" },
      { id: "u2", name: "Phellipe", email: "phellipe@nelcota.test", passwordHash: "x" },
    ]);
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
  });

  it("lists contacted and replied leads, overdue first, each once, only the partner's", async () => {
    await db
      .insert(leads)
      .values([
        lead({ id: "talking", status: "replied" }),
        lead({ id: "waiting", status: "contacted" }),
        lead({ id: "due", status: "replied", followUpOn: "2026-11-12" }),
        lead({ id: "late", status: "contacted", followUpOn: "2026-11-09" }),
        lead({ id: "new", status: "new" }),
        lead({ id: "closed", status: "closed" }),
        lead({ id: "theirs", status: "replied" }, "u2"),
      ]);
    const rows = await partnerLeadsInProgress(db, "u1", now);
    expect(rows.map((row) => row.id)).toEqual(["late", "due", "talking", "waiting"]);
  });

  it("shows at most five, and none for a partner without leads", async () => {
    await db
      .insert(leads)
      .values(
        Array.from({ length: 8 }, (_, index) => lead({ id: `c${index}`, status: "contacted" })),
      );
    expect(await partnerLeadsInProgress(db, "u1", now)).toHaveLength(5);
    expect(await partnerLeadsInProgress(db, "u2", now)).toEqual([]);
  });
});
