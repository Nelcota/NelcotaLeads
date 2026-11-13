import { describe, expect, it } from "vitest";
import type { Search } from "@/db/schema";
import { findPreviousSearch, previousSearchText } from "@/lib/previous-search";

let next = 0;
function search(overrides: Partial<Search>): Search {
  next += 1;
  return {
    id: `s-${next}`,
    niche: "Dentistas",
    city: "Belo Horizonte",
    maxResults: 20,
    status: "done",
    foundCount: 6,
    analyzedCount: 6,
    errorCount: 0,
    duplicateCount: 29,
    placesRequests: 1,
    errorMessage: null,
    origin: "manual",
    hiddenAt: null,
    createdAt: new Date("2026-10-10T15:00:00Z"),
    ...overrides,
  };
}

describe("findPreviousSearch", () => {
  it("finds the latest search with the same niche and city, ignoring case and accents", () => {
    const older = search({ createdAt: new Date("2026-10-01T15:00:00Z") });
    const latest = search({ niche: "dentistas", city: "belo horizonte" });
    expect(findPreviousSearch([older, latest], "DENTISTAS ", "Belo Horizonte")).toBe(latest);
  });

  it("returns null while a field is empty or nothing matches", () => {
    const searches = [search({})];
    expect(findPreviousSearch(searches, "Dentistas", "")).toBeNull();
    expect(findPreviousSearch(searches, "Dentistas", "Contagem")).toBeNull();
  });
});

describe("previousSearchText", () => {
  it("says how many already existed", () => {
    expect(previousSearchText(search({}))).toBe("Você buscou isso em 10/10: 29 de 35 já existiam.");
  });

  it("speaks of a running, failed or empty search", () => {
    expect(previousSearchText(search({ status: "collecting" }))).toBe(
      "Essa busca já está em andamento.",
    );
    expect(previousSearchText(search({ status: "error" }))).toBe(
      "Você tentou isso em 10/10 e a busca falhou.",
    );
    expect(previousSearchText(search({ foundCount: 0, duplicateCount: 0 }))).toBe(
      "Você buscou isso em 10/10 e o Google não trouxe nenhuma empresa.",
    );
  });
});
