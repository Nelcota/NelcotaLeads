import { describe, expect, it } from "vitest";
import { addDays, dayDiff, relativeDay, sharePercent } from "./format";

describe("sharePercent", () => {
  it("is a whole percent of a larger or equal total", () => {
    expect(sharePercent(0, 10)).toBe(0);
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(10, 10)).toBe(100);
  });

  it("has no share when the total is empty or smaller (never over 100%)", () => {
    expect(sharePercent(0, 0)).toBeNull();
    expect(sharePercent(5, 0)).toBeNull();
    expect(sharePercent(11, 10)).toBeNull();
    expect(sharePercent(-1, 10)).toBeNull();
  });
});

describe("calendar days", () => {
  it("adds days across month, year and leap-day ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-10-13", 0)).toBe("2026-10-13");
  });

  it("counts whole days between two days", () => {
    expect(dayDiff("2026-10-13", "2026-10-13")).toBe(0);
    expect(dayDiff("2026-10-13", "2026-10-14")).toBe(1);
    expect(dayDiff("2026-10-14", "2026-10-13")).toBe(-1);
    expect(dayDiff("2027-12-31", "2028-12-31")).toBe(366);
  });

  it("names the days around today and dates the rest", () => {
    const today = "2026-10-13";
    expect(relativeDay("2026-10-13", today)).toBe("hoje");
    expect(relativeDay("2026-10-14", today)).toBe("amanhã");
    expect(relativeDay("2026-10-12", today)).toBe("ontem");
    expect(relativeDay("2026-10-20", today)).toBe("em 7 dias");
    expect(relativeDay("2026-10-21", today)).toBe("21/10");
    expect(relativeDay("2026-10-06", today)).toBe("há 7 dias");
    expect(relativeDay("2026-10-05", today)).toBe("05/10");
  });
});
