import { describe, expect, it } from "vitest";
import {
  emailReplySchema,
  idSchema,
  leadAnalysisSchema,
  leadFiltersSchema,
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
