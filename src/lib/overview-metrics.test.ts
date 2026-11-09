import { describe, expect, it } from "vitest";
import {
  averageTicket,
  closingRateLabel,
  costPerDeal,
  formatUsd,
  lossBreakdown,
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
  it("lists the reasons given, most common first, with share and bar", () => {
    const { total, bars } = lossBreakdown([
      { reason: "not_now", count: 1 },
      { reason: "price", count: 3 },
    ]);
    expect(total).toBe(4);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({
      reason: "price",
      label: "Preço alto",
      count: 3,
      percent: 75,
      share: 1,
    });
    expect(bars[1]).toMatchObject({ reason: "not_now", percent: 25 });
  });

  it("is empty without losses", () => {
    const { total, bars } = lossBreakdown([]);
    expect(total).toBe(0);
    expect(bars).toEqual([]);
  });
});

describe("closing rate and loss reasons", () => {
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
