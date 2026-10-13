import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { getDb } from "@/db/client";
import { quickReplies } from "@/db/schema";
import { quickRepliesInputSchema } from "@/lib/schemas";
import { resetDb } from "../../test/reset-db";
import { loadQuickReplies, storeQuickReplies } from "./quick-replies";

const db = getDb(env.DB);
const reply = (n: number) => ({ title: `Modelo ${n}`, body: `Texto ${n}` });

describe("quick replies", () => {
  beforeEach(resetDb);

  it("is empty before anything is saved", async () => {
    expect(await loadQuickReplies(db)).toEqual([]);
  });

  it("replaces the whole list and keeps its order", async () => {
    await storeQuickReplies(db, [reply(1), reply(2), reply(3)]);
    await storeQuickReplies(db, [reply(3), reply(1)]);
    const saved = await loadQuickReplies(db);
    expect(saved.map(({ title, body }) => ({ title, body }))).toEqual([reply(3), reply(1)]);
    expect(new Set(saved.map((item) => item.id)).size).toBe(2);

    await storeQuickReplies(db, []);
    expect(await loadQuickReplies(db)).toEqual([]);
  });

  it("refuses more than 10 answers or a text over 1,000 characters", async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => reply(i));
    await expect(storeQuickReplies(db, eleven)).rejects.toThrow(ZodError);
    await expect(
      storeQuickReplies(db, [{ title: "Longo", body: "a".repeat(1001) }]),
    ).rejects.toThrow("Até 1.000 caracteres");
    expect(
      quickRepliesInputSchema.safeParse({ replies: [{ title: " ", body: "x" }] }).success,
    ).toBe(false);
    expect(await loadQuickReplies(db)).toEqual([]);
  });

  it("leaves out a stored row that no longer validates", async () => {
    await storeQuickReplies(db, [reply(1)]);
    await db.insert(quickReplies).values({ id: "bad", title: "", body: "x", position: 1 });
    expect((await loadQuickReplies(db)).map((item) => item.title)).toEqual(["Modelo 1"]);
  });
});
