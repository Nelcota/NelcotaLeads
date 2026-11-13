import { describe, expect, it } from "vitest";
import type { Search } from "@/db/schema";
import {
  analysisPercent,
  countSearches,
  matchesSearchFilter,
  searchDetails,
  summarizeSearches,
} from "./search-list";

function search(overrides: Partial<Search> = {}): Search {
  return {
    id: "s1",
    niche: "dentistas",
    city: "Belo Horizonte",
    maxResults: 20,
    status: "done",
    foundCount: 6,
    analyzedCount: 6,
    errorCount: 0,
    duplicateCount: 29,
    placesRequests: 2,
    errorMessage: null,
    origin: "autopilot",
    hiddenAt: null,
    createdAt: new Date("2026-11-10T11:00:00Z"),
    updatedAt: new Date("2026-11-10T11:00:00Z"),
    ...overrides,
  } as Search;
}

describe("matchesSearchFilter", () => {
  it("keeps hidden searches only in Ocultas", () => {
    const hidden = search({ hiddenAt: new Date() });
    expect(matchesSearchFilter(hidden, "hidden")).toBe(true);
    expect(matchesSearchFilter(hidden, "all")).toBe(false);
    expect(matchesSearchFilter(hidden, "done")).toBe(false);
  });

  it("puts collecting and analyzing under Em andamento", () => {
    expect(matchesSearchFilter(search({ status: "collecting" }), "running")).toBe(true);
    expect(matchesSearchFilter(search({ status: "analyzing" }), "running")).toBe(true);
    expect(matchesSearchFilter(search({ status: "done" }), "running")).toBe(false);
  });

  it("puts errors under Com falha", () => {
    expect(matchesSearchFilter(search({ status: "error" }), "failed")).toBe(true);
    expect(matchesSearchFilter(search({ status: "cancelled" }), "failed")).toBe(false);
  });
});

describe("countSearches and summarizeSearches", () => {
  const list = [
    search({ id: "a", foundCount: 24 }),
    search({ id: "b", status: "analyzing", foundCount: 10 }),
    search({ id: "c", hiddenAt: new Date(), foundCount: 9 }),
  ];

  it("counts per filter", () => {
    expect(countSearches(list, "all")).toBe(2);
    expect(countSearches(list, "running")).toBe(1);
    expect(countSearches(list, "hidden")).toBe(1);
  });

  it("leaves hidden searches out of the summary", () => {
    expect(summarizeSearches(list)).toEqual({ searches: 2, newLeads: 34, running: 1 });
  });

  it("summarizes an empty list as zeros", () => {
    expect(summarizeSearches([])).toEqual({ searches: 0, newLeads: 0, running: 0 });
  });
});

describe("searchDetails and analysisPercent", () => {
  it("adds new and known companies for what Google found", () => {
    expect(searchDetails(search()).foundOnGoogle).toBe(35);
  });

  it("is 0 with nothing found and never passes 100", () => {
    expect(analysisPercent(search({ foundCount: 0, analyzedCount: 0 }))).toBe(0);
    expect(analysisPercent(search({ foundCount: 24, analyzedCount: 15 }))).toBe(63);
    expect(analysisPercent(search({ foundCount: 4, analyzedCount: 4, errorCount: 2 }))).toBe(100);
  });
});
