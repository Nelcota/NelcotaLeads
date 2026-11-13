import { describe, expect, it } from "vitest";
import type { Search } from "@/db/schema";
import { stateLabel, stateRoutes } from "@/lib/map-geometry";
import {
  rankStates,
  runningPlaces,
  stateYield,
  statsByState,
  summarizeBrazil,
  summarizeState,
} from "@/lib/search-map";
import type { SearchWithState } from "@/lib/search-state";
import { matchStates } from "@/lib/state-match";

let next = 0;
function search(overrides: Partial<SearchWithState>): SearchWithState {
  next += 1;
  const base: Search = {
    id: `s-${next}`,
    niche: "Dentistas",
    city: "Belo Horizonte",
    maxResults: 20,
    status: "done",
    foundCount: 0,
    analyzedCount: 0,
    errorCount: 0,
    duplicateCount: 0,
    placesRequests: 1,
    errorMessage: null,
    origin: "manual",
    hiddenAt: null,
    createdAt: new Date("2026-11-12T10:00:00Z"),
  };
  return { ...base, state: "MG", highScoreCount: 0, ...overrides };
}

describe("statsByState", () => {
  it("counts visible searches, new leads and running ones per state", () => {
    const running = search({ status: "collecting", foundCount: 3 });
    const stats = statsByState([
      search({ foundCount: 10 }),
      running,
      search({ state: "SP", foundCount: 4 }),
      search({ foundCount: 99, hiddenAt: new Date() }),
      search({ state: null, foundCount: 7 }),
    ]);
    expect(stats.get("MG")).toEqual({ searches: 2, newLeads: 13, running: [running] });
    expect(stats.get("SP")?.newLeads).toBe(4);
    expect(stats.size).toBe(2);
  });
});

describe("rankStates", () => {
  it("puts the state with most new leads first", () => {
    const ranked = rankStates(
      statsByState([search({ foundCount: 2 }), search({ state: "ES", foundCount: 8 })]),
    );
    expect(ranked.map((row) => row.state.code)).toEqual(["ES", "MG"]);
  });
});

describe("stateYield", () => {
  it("is the share of new companies in finished searches", () => {
    expect(stateYield([search({ foundCount: 6, duplicateCount: 2 })])).toBe(75);
  });

  it("is null before any finished search", () => {
    expect(stateYield([search({ status: "collecting", foundCount: 4 })])).toBeNull();
  });
});

describe("summarizeBrazil", () => {
  it("adds up the placed searches and counts the unplaced ones apart", () => {
    const running = search({ status: "analyzing", foundCount: 5 });
    const summary = summarizeBrazil([
      search({ foundCount: 10 }),
      running,
      search({ state: null, foundCount: 3 }),
      search({ state: null, hiddenAt: new Date() }),
    ]);
    expect(summary).toMatchObject({ searches: 2, newLeads: 15, unplaced: 1, topLeads: 15 });
    expect(summary.running).toEqual([running]);
  });
});

describe("summarizeState", () => {
  it("splits a state's searches into running and the last three finished", () => {
    const running = search({ state: "ES", status: "collecting" });
    const finished = [1, 2, 3, 4].map(() => search({ state: "ES", foundCount: 2 }));
    const summary = summarizeState([running, ...finished, search({ foundCount: 9 })], "ES");
    expect(summary).toMatchObject({ searches: 5, newLeads: 8, yieldPercent: 100 });
    expect(summary.running).toEqual([running]);
    expect(summary.recent).toEqual(finished.slice(0, 3));
  });
});

describe("runningPlaces", () => {
  it("lists each place once, with how many searches run there", () => {
    const places = runningPlaces([
      search({ city: "Belo Horizonte" }),
      search({ city: "Juiz de Fora" }),
      search({ city: "Belo Horizonte" }),
    ]);
    expect(places).toBe("Belo Horizonte (2) · Juiz de Fora");
  });
});

describe("matchStates", () => {
  it("groups every state by region while nothing is typed", () => {
    const groups = matchStates("");
    expect(groups.map((group) => group.name)).toEqual([
      "Norte",
      "Nordeste",
      "Centro-Oeste",
      "Sudeste",
      "Sul",
    ]);
    expect(groups.flatMap((group) => group.states)).toHaveLength(27);
  });

  it("finds by name without accents or by code", () => {
    expect(matchStates("parana")[0]?.states.map((state) => state.code)).toEqual(["PR"]);
    expect(matchStates("mg")[0]?.states.map((state) => state.code)).toEqual(["MG"]);
  });

  it("returns nothing when no state matches", () => {
    expect(matchStates("xyz")).toEqual([]);
  });
});

describe("map geometry", () => {
  it("draws four routes from inside the state", () => {
    const routes = stateRoutes("MG");
    expect(routes).toHaveLength(4);
    expect(routes[0]).toMatch(/^M[\d.]+ [\d.]+ Q/);
  });

  it("puts small states' labels outside, with a guide line", () => {
    expect(stateLabel("DF")).toMatchObject({ side: "left", x: 391 });
    expect(stateLabel("MG")).toMatchObject({ side: "center", guide: null });
  });
});
