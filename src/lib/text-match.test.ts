import { describe, expect, it } from "vitest";
import { filterByLabel, foldText, matchParts } from "./text-match";

describe("foldText", () => {
  it("drops accents and case", () => {
    expect(foldText("Óticas São João")).toBe("oticas sao joao");
  });
});

describe("matchParts", () => {
  it("splits the label around an accent-free match, keeping the original letters", () => {
    expect(matchParts("Óticas em Contagem", "otica")).toEqual({
      before: "",
      match: "Ótica",
      after: "s em Contagem",
    });
  });

  it("puts the whole label in before when nothing matches", () => {
    expect(matchParts("Padarias", "pet")).toEqual({ before: "Padarias", match: "", after: "" });
  });

  it("marks nothing for an empty query", () => {
    expect(matchParts("Padarias", "")).toEqual({ before: "Padarias", match: "", after: "" });
  });
});

describe("filterByLabel", () => {
  const items = [{ label: "Odontologia" }, { label: "Óticas" }, { label: "Pet shops" }];

  it("keeps every item for an empty query", () => {
    expect(filterByLabel(items, "")).toHaveLength(3);
  });

  it("keeps the matches in order", () => {
    expect(filterByLabel(items, "o").map((item) => item.label)).toEqual([
      "Odontologia",
      "Óticas",
      "Pet shops",
    ]);
    expect(filterByLabel(items, "otic").map((item) => item.label)).toEqual(["Óticas"]);
  });
});
