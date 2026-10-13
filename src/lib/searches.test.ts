import { describe, expect, it } from "vitest";
import { MANUAL_SEARCH_ID, searchLabel } from "./searches";

describe("searchLabel", () => {
  it("names a search by niche and city, and the manual one by what it is", () => {
    expect(searchLabel({ id: "s", niche: "dentistas", city: "BH" })).toBe("dentistas em BH");
    expect(searchLabel({ id: MANUAL_SEARCH_ID, niche: "x", city: "" })).toBe(
      "Adicionados manualmente",
    );
  });
});
