import { describe, expect, it } from "vitest";
import { hasNicheActivity, nicheCaption, nicheSteps, nicheTags, tagsOf } from "./niche-metrics";

/** A niche whose deals in the period are all of leads contacted in it. */
const outcome = (key: string, contacted: number, won: number, lost: number) => ({
  key,
  contacted,
  won,
  lost,
  cohortWon: won,
  cohortLost: lost,
});

describe("niche tags", () => {
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

  it("gives a niche both tags when it closes and refuses the most", () => {
    const tags = { mostCloses: "novos", mostRefuses: "novos" };
    expect(tagsOf("novos", tags)).toEqual(["mostCloses", "mostRefuses"]);
    expect(tagsOf("outros", tags)).toEqual([]);
  });

  it("names who closes the most, or says what the card compares", () => {
    const niches = [{ key: "dentistas", label: "Dentistas" }];
    expect(nicheCaption(niches, "dentistas")).toBe("Dentistas é quem mais fecha.");
    expect(nicheCaption(niches, null)).toBe("quem responde, fecha e recusa mais, por área.");
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

  it("shows a deal from an earlier contact without a percent", () => {
    const steps = nicheSteps({ ...niche, won: 1, cohortWon: 0 });
    expect(steps[2]).toMatchObject({ value: 1, percent: null, width: 3 });
  });

  it("knows a niche with only found leads has no activity", () => {
    expect(hasNicheActivity({ contacted: 0, won: 0, lost: 0 })).toBe(false);
    expect(hasNicheActivity({ contacted: 0, won: 1, lost: 0 })).toBe(true);
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
