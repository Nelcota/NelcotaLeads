import { describe, expect, it } from "vitest";
import type { Search } from "@/db/schema";
import { stateLabel, stateRoutes } from "@/lib/map-geometry";
import { matchStates, rankStates, runningPlaces, stateYield, statsByState } from "@/lib/search-map";
import type { SearchWithState } from "@/lib/search-state";

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
  return { ...base, state: "MG", ...overrides };
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
