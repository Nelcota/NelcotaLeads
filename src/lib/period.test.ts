import { describe, expect, it } from "vitest";
import { DEFAULT_PERIOD, periodRange, readPeriod } from "./period";

// 02:00Z on the 4th is still 23:00 of the 3rd in Brazil.
const LATE_EVENING = new Date("2026-11-04T02:00:00Z");

describe("periodRange", () => {
  it("counts today as one of the last 7 or 30 days, in Brazil time", () => {
    const week = periodRange("7d", LATE_EVENING);
    expect(week.fromDay).toBe("2026-10-28");
    expect(week.toDay).toBe("2026-11-03");
    expect(week.from.toISOString()).toBe("2026-10-28T03:00:00.000Z");
    expect(week.to.toISOString()).toBe("2026-11-04T03:00:00.000Z");
    expect(periodRange("30d", LATE_EVENING).fromDay).toBe("2026-10-05");
  });

  it("starts this month on the first, up to today", () => {
    const month = periodRange("month", LATE_EVENING);
    expect(month.fromDay).toBe("2026-11-01");
    expect(month.toDay).toBe("2026-11-03");
    expect(month.from.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("falls back to 30 days without ?period=", () => {
    expect(DEFAULT_PERIOD).toBe("30d");
    expect(readPeriod(undefined)).toBe("30d");
    expect(readPeriod("7d")).toBe("7d");
  });
});
