import { describe, expect, it } from "vitest";
import {
  averageTicket,
  closingRateLabel,
  costPerDeal,
  formatUsd,
  lossBreakdown,
  nicheSteps,
  nicheTags,
  percentLabel,
  ratePercent,
  replyRateLabel,
  topLossReasons,
} from "./overview-metrics";

describe("rates and money", () => {
  it("gives a percent, past 100% too, or nothing without a base", () => {
    expect(ratePercent(1, 4)).toBe(25);
    expect(ratePercent(5, 4)).toBe(125);
    expect(ratePercent(3, 0)).toBeNull();
    expect(percentLabel(3, 0)).toBe("—");
  });

  it("averages the ticket and the AI cost per deal only with deals", () => {
    expect(averageTicket(300_000, 2)).toBe(150_000);
    expect(averageTicket(0, 0)).toBeNull();
    expect(costPerDeal(1.5, 3)).toBeCloseTo(0.5);
    expect(costPerDeal(1.5, 0)).toBeNull();
    expect(formatUsd(0.5)).toBe("US$ 0,50");
  });

  it("says replies over sends", () => {
    expect(replyRateLabel({ sent: 40, replied: 3 })).toBe("3 respostas em 40 envios");
    expect(replyRateLabel({ sent: 1, replied: 1 })).toBe("1 resposta em 1 envio");
  });
});

describe("lossBreakdown", () => {
  it("lists all nine reasons, most common first, with share and bar", () => {
    const { total, bars } = lossBreakdown([
      { reason: "not_now", count: 1 },
      { reason: "price", count: 3 },
    ]);
    expect(total).toBe(4);
    expect(bars).toHaveLength(9);
    expect(bars[0]).toEqual({
      reason: "price",
      label: "Preço alto",
      count: 3,
      percent: 75,
      share: 1,
    });
    expect(bars[1]).toMatchObject({ reason: "not_now", percent: 25 });
    expect(bars[2]).toMatchObject({ reason: "has_provider", count: 0, share: 0 });
  });

  it("is all zeros without losses", () => {
    const { total, bars } = lossBreakdown([]);
    expect(total).toBe(0);
    expect(bars.every((bar) => bar.count === 0 && bar.percent === 0)).toBe(true);
  });
});

/** A niche whose deals in the period are all of leads contacted in it. */
const outcome = (key: string, contacted: number, won: number, lost: number) => ({
  key,
  contacted,
  won,
  lost,
  cohortWon: won,
  cohortLost: lost,
});

describe("niche tags and reasons", () => {
  it("tags the best closing share (1+ deal) and the highest loss share (2+ losses)", () => {
    const tags = nicheTags([
      outcome("dentistas", 10, 2, 1),
      outcome("academias", 2, 1, 0),
      outcome("padarias", 4, 0, 2),
      outcome("bares", 1, 0, 1),
    ]);
    expect(tags).toEqual({ mostCloses: "academias", mostRefuses: "padarias" });
  });

  it("tags nobody below the minimums", () => {
    expect(nicheTags([outcome("a", 3, 0, 1)])).toEqual({ mostCloses: null, mostRefuses: null });
  });

  it("takes the shares within the contacted cohort, never from deals of older leads", () => {
    // "antigos" closed 5 deals of leads contacted months ago: 5 of 1 would be 500%.
    const tags = nicheTags([
      { key: "antigos", contacted: 1, won: 5, lost: 0, cohortWon: 0, cohortLost: 0 },
      { key: "novos", contacted: 4, won: 1, lost: 3, cohortWon: 1, cohortLost: 2 },
    ]);
    expect(tags).toEqual({ mostCloses: "novos", mostRefuses: "novos" });
  });

  it("ranks by the raw counts when no niche has a cohort", () => {
    const tags = nicheTags([
      { key: "a", contacted: 0, won: 1, lost: 2, cohortWon: 0, cohortLost: 0 },
      { key: "b", contacted: 0, won: 3, lost: 4, cohortWon: 0, cohortLost: 0 },
    ]);
    expect(tags).toEqual({ mostCloses: "b", mostRefuses: "b" });
  });

  it("says the closing rate of the contacted, with the counts", () => {
    expect(closingRateLabel(3, 25)).toBe("12% · 3 de 25");
    expect(closingRateLabel(0, 0)).toBe("—");
  });

  it("picks each niche's most common loss reason, ties by list order", () => {
    const top = topLossReasons([
      { key: "a", reason: "not_now", count: 2 },
      { key: "a", reason: "price", count: 2 },
      { key: "b", reason: "other", count: 1 },
      { key: "b", reason: "has_provider", count: 3 },
    ]);
    expect(top.get("a")).toBe("price");
    expect(top.get("b")).toBe("has_provider");
  });
});

describe("nicheSteps", () => {
  const niche = {
    key: "dentistas",
    contacted: 30,
    replied: 9,
    won: 4,
    lost: 2,
    cohortWon: 3,
    cohortLost: 2,
  };

  it("starts at the contacted base and shares the rest of it", () => {
    const steps = nicheSteps(niche);
    expect(steps.map((step) => step.label)).toEqual([
      "Contatados",
      "Responderam",
      "Fecharam",
      "Recusaram",
    ]);
    expect(steps[0]).toMatchObject({ value: 30, percent: null, width: 100 });
    expect(steps[1]).toMatchObject({ value: 9, percent: 30, width: 30 });
    expect(steps[2]).toMatchObject({ value: 4, percent: 10, width: 10 });
    expect(steps[3]).toMatchObject({ value: 2, percent: 7, width: 7 });
  });

  it("keeps a small share visible and empty bars at zero", () => {
    const steps = nicheSteps({ ...niche, contacted: 100, replied: 1, cohortWon: 0, won: 0 });
    expect(steps[1].width).toBe(3);
    expect(steps[2]).toMatchObject({ percent: 0, width: 0 });
  });

  it("has no shares without contacted leads", () => {
    const steps = nicheSteps({
      ...niche,
      contacted: 0,
      replied: 0,
      won: 0,
      lost: 0,
      cohortWon: 0,
      cohortLost: 0,
    });
    expect(steps.every((step) => step.width === 0)).toBe(true);
    expect(steps.slice(1).every((step) => step.percent === null)).toBe(true);
  });
});
