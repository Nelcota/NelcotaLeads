import { describe, expect, it } from "vitest";
import { foldText, matchesQuery } from "./text-search";

describe("foldText", () => {
  it("drops accents and case", () => {
    expect(foldText("Clínica São João")).toBe("clinica sao joao");
    expect(foldText("AÇÃO")).toBe("acao");
  });
});

describe("matchesQuery", () => {
  const row = ["Clínica Sorriso", "contato@sorriso.test", "Você: Posso te ligar amanhã?"];

  it.each([
    ["", true],
    ["   ", true],
    ["clinica", true],
    ["CLÍNICA", true],
    ["sorriso.test", true],
    ["amanha", true],
    ["clinica amanha", true],
    ["aurora", false],
    ["clinica aurora", false],
  ])("%j → %s", (query, expected) => {
    expect(matchesQuery(row, query)).toBe(expected);
  });

  it("skips missing fields", () => {
    expect(matchesQuery(["Clínica", null, undefined], "clin")).toBe(true);
  });
});
