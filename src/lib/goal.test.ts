import { describe, expect, it } from "vitest";
import {
  daysElapsed,
  daysInMonth,
  daysLeft,
  goalFormValues,
  goalPace,
  monthName,
  monthProjection,
  monthRange,
  paceLine,
  parseGoalForm,
  progressPercent,
} from "./goal";

describe("month math", () => {
  it("knows how long each month is, leap years included", () => {
    expect(daysInMonth("2026-11")).toBe(30);
    expect(daysInMonth("2026-12")).toBe(31);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
  });

  it("counts elapsed and remaining days with today in both", () => {
    expect(daysElapsed("2026-11-03")).toBe(3);
    expect(daysLeft("2026-11-03")).toBe(28);
    expect(daysLeft("2026-11-30")).toBe(1);
  });

  it("bounds the month at Brazil midnights", () => {
    const range = monthRange("2026-11");
    expect(range.fromDay).toBe("2026-11-01");
    expect(range.toDay).toBe("2026-11-30");
    expect(range.from.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("names the month in Portuguese", () => {
    expect(monthName("2026-03")).toBe("março");
  });
});

describe("goalPace", () => {
  const goal = { deals: 10, revenueCents: 1_500_000 };

  it("measures progress, what is left and the weekly pace so far", () => {
    const pace = goalPace(goal, { deals: 3, revenueCents: 450_000 }, "2026-11-14");
    expect(pace).toEqual({
      dealsPercent: 30,
      revenuePercent: 30,
      remainingDeals: 7,
      daysLeft: 17,
      weeklyPace: 1.5,
    });
    expect(paceLine(pace)).toBe("Faltam 7 fechamentos em 17 dias · no ritmo atual, 1,5 por semana");
  });

  it("caps the bars at 100% and says when the goal was reached", () => {
    const pace = goalPace(goal, { deals: 12, revenueCents: 3_000_000 }, "2026-11-20");
    expect(pace.dealsPercent).toBe(100);
    expect(pace.revenuePercent).toBe(100);
    expect(pace.remainingDeals).toBe(0);
    expect(paceLine(pace)).toBe("Meta de fechamentos batida neste mês.");
  });

  it("uses the singular for one deal and one day", () => {
    expect(paceLine({ remainingDeals: 1, daysLeft: 1, weeklyPace: 0 })).toBe(
      "Falta 1 fechamento em 1 dia · no ritmo atual, 0 por semana",
    );
  });

  it("gives no progress against an empty target", () => {
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe("parseGoalForm", () => {
  it("reads deals and pt-BR money", () => {
    expect(parseGoalForm({ deals: " 8 ", revenue: "R$ 12.000,50" })).toEqual({
      ok: true,
      value: { deals: 8, revenueCents: 1_200_050 },
    });
  });

  it("refuses missing, zero or broken values", () => {
    expect(parseGoalForm({ deals: "", revenue: "100" }).ok).toBe(false);
    expect(parseGoalForm({ deals: "2.5", revenue: "100" }).ok).toBe(false);
    expect(parseGoalForm({ deals: "0", revenue: "100" })).toEqual({
      ok: false,
      error: "A meta precisa de pelo menos 1 fechamento.",
    });
    expect(parseGoalForm({ deals: "3", revenue: "abc" }).ok).toBe(false);
  });

  it("fills the form from the goal in force", () => {
    expect(goalFormValues({ deals: 4, revenueCents: 800_000 })).toEqual({
      deals: "4",
      revenue: "8.000,00",
    });
    expect(goalFormValues(null)).toEqual({ deals: "", revenue: "" });
  });
});

describe("monthProjection", () => {
  it("stretches the cost so far over the whole month", () => {
    expect(monthProjection(3, "2026-11-10")).toBeCloseTo(9);
    expect(monthProjection(0, "2026-11-01")).toBe(0);
  });
});
