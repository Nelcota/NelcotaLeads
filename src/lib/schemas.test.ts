import { describe, expect, it } from "vitest";
import {
  bulkSnapshotSchema,
  DAY_RANGE,
  emailReplySchema,
  idSchema,
  isCalendarDay,
  MAX_UNIX_SECONDS,
  scoreTier,
  leadAnalysisSchema,
  leadFiltersSchema,
  lenientSearch,
  newSearchSchema,
  outreachEmailSchema,
  updateLeadSchema,
} from "./schemas";

describe("AI output bounds", () => {
  const analysis = {
    summary: "Clínica odontológica.",
    signals: ["Sem site"],
    painPoints: [],
    score: 40,
    scoreReasoning: "Sem site (+25).",
  };

  it("rejects empty, oversized or too many items", () => {
    expect(leadAnalysisSchema.safeParse(analysis).success).toBe(true);
    expect(leadAnalysisSchema.safeParse({ ...analysis, summary: "" }).success).toBe(false);
    expect(leadAnalysisSchema.safeParse({ ...analysis, summary: "x".repeat(1001) }).success).toBe(
      false,
    );
    expect(
      leadAnalysisSchema.safeParse({ ...analysis, signals: Array(11).fill("Sem site") }).success,
    ).toBe(false);
    expect(leadAnalysisSchema.safeParse({ ...analysis, signals: ["x".repeat(301)] }).success).toBe(
      false,
    );
    expect(outreachEmailSchema.safeParse({ subject: "x".repeat(201), body: "Oi" }).success).toBe(
      false,
    );
  });

  it("allows an empty reply or draft when the action does not use it", () => {
    expect(
      emailReplySchema.safeParse({ action: "close", reason: "Sem interesse", reply: "", draft: "" })
        .success,
    ).toBe(true);
    expect(
      emailReplySchema.safeParse({
        action: "reply",
        reason: "ok",
        reply: "x".repeat(5001),
        draft: "",
      }).success,
    ).toBe(false);
  });
});

describe("user input", () => {
  it("normalizes text to NFC and trims notes", () => {
    const decomposed = "São Paulo".normalize("NFD");
    expect(
      newSearchSchema.parse({ niche: "dentistas", city: decomposed, maxResults: 5 }).city,
    ).toBe("São Paulo");
    expect(updateLeadSchema.parse({ id: "a", notes: "  ligar  " }).notes).toBe("ligar");
  });

  it("bounds ids", () => {
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("x".repeat(65)).success).toBe(false);
    expect(idSchema.safeParse(crypto.randomUUID()).success).toBe(true);
  });

  it("only takes known sort fields and directions from the URL", () => {
    expect(leadFiltersSchema.parse({ sort: "name", dir: "asc" })).toMatchObject({ dir: "asc" });
    expect(leadFiltersSchema.safeParse({ dir: "asc; drop table leads" }).success).toBe(false);
    expect(leadFiltersSchema.safeParse({ sort: "email" }).success).toBe(false);
  });
});

describe("follow-up days", () => {
  it("accepts real days within the range, both ends included", () => {
    for (const day of [DAY_RANGE.min, DAY_RANGE.max, "2028-02-29", "2026-12-31", "2026-01-01"]) {
      expect(isCalendarDay(day)).toBe(true);
    }
  });

  it("refuses impossible days, other shapes and days outside the range", () => {
    for (const day of [
      "1999-12-31",
      "2100-01-01",
      "0002-10-13",
      "0000-00-00",
      "2026-13-01",
      "2026-00-10",
      "2026-02-29",
      "2026-02-30",
      "2026-04-31",
      "2026-1-1",
      "20261-01-01",
      "2026-10-13T00:00",
      "",
    ]) {
      expect(isCalendarDay(day)).toBe(false);
    }
  });

  it("guards every schema that stores one", () => {
    expect(updateLeadSchema.safeParse({ id: "a", followUpOn: "2026-02-30" }).success).toBe(false);
    expect(updateLeadSchema.safeParse({ id: "a", followUpOn: "2026-10-13" }).success).toBe(true);
    expect(updateLeadSchema.safeParse({ id: "a", followUpOn: null }).success).toBe(true);
  });
});

describe("bulk undo snapshot", () => {
  const snapshot = {
    id: "a",
    status: "new",
    followUpOn: null,
    discardReason: null,
    discardedAt: 0,
  } as const;

  it("takes discard times from 0 to MAX_UNIX_SECONDS", () => {
    for (const discardedAt of [0, 1_760_000_000, MAX_UNIX_SECONDS, null]) {
      expect(bulkSnapshotSchema.safeParse({ ...snapshot, discardedAt }).success).toBe(true);
    }
  });

  it("refuses times a Date cannot hold (they were stored as NULL)", () => {
    for (const discardedAt of [-1, MAX_UNIX_SECONDS + 1, 1e15, 1.5]) {
      expect(bulkSnapshotSchema.safeParse({ ...snapshot, discardedAt }).success).toBe(false);
    }
  });
});

describe("score tiers", () => {
  it("puts each boundary in the right band", () => {
    expect([0, 29, 30, 59, 60, 100].map(scoreTier)).toEqual([
      "low",
      "low",
      "medium",
      "medium",
      "high",
      "high",
    ]);
  });
});

describe("lenientSearch", () => {
  const search = lenientSearch(leadFiltersSchema);

  it("drops bad URL params instead of failing the page, keeping the good ones", () => {
    expect(
      search.parse({ view: "foo", minScore: 500, q: 123, dir: "asc; drop", sort: "name" }),
    ).toEqual({ sort: "name" });
    expect(search.parse({ q: "x".repeat(500), view: "all" })).toEqual({ view: "all" });
  });

  it("leaves the server-side schema strict", () => {
    expect(leadFiltersSchema.safeParse({ view: "foo" }).success).toBe(false);
  });
});
