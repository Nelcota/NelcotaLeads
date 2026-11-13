import { describe, expect, it } from "vitest";
import { lastDailySearch, leadsBelow, minScoreImpact, nextDailySearch } from "./settings-overview";

const bands = [
  { band: 0, leads: 2 },
  { band: 5, leads: 4 },
  { band: 6, leads: 3 },
  { band: 20, leads: 1 },
];

describe("leadsBelow", () => {
  it("counts the bands under the minimum score, never the band it starts", () => {
    expect(leadsBelow(bands, 30)).toEqual({ below: 6, total: 10 });
    expect(leadsBelow(bands, 31)).toEqual({ below: 9, total: 10 });
    expect(leadsBelow(bands, 0)).toEqual({ below: 0, total: 10 });
    expect(leadsBelow(bands, 100)).toEqual({ below: 9, total: 10 });
  });
});

describe("minScoreImpact", () => {
  it("says how many analyzed leads fall below", () => {
    expect(minScoreImpact(bands, 30)).toBe(
      "Com 30, ficariam abaixo da nota 6 de 10 leads analisados.",
    );
    expect(minScoreImpact([{ band: 1, leads: 1 }], 10)).toBe(
      "Com 10, ficaria abaixo da nota 1 de 1 lead analisado.",
    );
  });

  it("covers zero and no data", () => {
    expect(minScoreImpact(bands, 0)).toBe(
      "Com 0, nenhum de 10 leads analisados ficaria abaixo da nota.",
    );
    expect(minScoreImpact([], 30)).toBe("Ainda não há leads analisados para comparar.");
  });
});

describe("nextDailySearch", () => {
  const on = { enabled: true, hour: 8, targets: 2, lastRunOn: null };

  it("runs today before its hour and tomorrow after it or once today ran", () => {
    expect(nextDailySearch(on, "2026-11-13", 7)).toBe("Hoje, 8h");
    expect(nextDailySearch(on, "2026-11-13", 8)).toBe("Amanhã, 8h");
    expect(nextDailySearch({ ...on, lastRunOn: "2026-11-13" }, "2026-11-13", 6)).toBe("Amanhã, 8h");
  });

  it("is null when off or with nothing to search", () => {
    expect(nextDailySearch({ ...on, enabled: false }, "2026-11-13", 7)).toBeNull();
    expect(nextDailySearch({ ...on, targets: 0 }, "2026-11-13", 7)).toBeNull();
  });
});

describe("lastDailySearch", () => {
  it("reads today, yesterday or the date", () => {
    expect(lastDailySearch("2026-11-13", "2026-11-13")).toBe("hoje");
    expect(lastDailySearch("2026-11-12", "2026-11-13")).toBe("ontem");
    expect(lastDailySearch("2026-11-02", "2026-11-13")).toBe("02/11");
    expect(lastDailySearch(null, "2026-11-13")).toBeNull();
  });
});
