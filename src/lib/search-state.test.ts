import { describe, expect, it } from "vitest";
import { searchState, stateFromAddress, stateFromCity } from "@/lib/search-state";

describe("stateFromAddress", () => {
  it("reads the state after the city", () => {
    expect(
      stateFromAddress("Av. Afonso Pena, 1500 - Centro, Belo Horizonte - MG, 30130-005, Brasil"),
    ).toBe("MG");
  });

  it("reads an address without a postal code", () => {
    expect(stateFromAddress("Contagem - MG, Brasil")).toBe("MG");
  });

  it("ignores a neighborhood dash and takes the last state", () => {
    expect(stateFromAddress("R. Bahia, 10 - Funcionários, São Paulo - SP, 01000-000")).toBe("SP");
  });

  it("returns null without a state", () => {
    expect(stateFromAddress("Rua sem estado, 12")).toBeNull();
    expect(stateFromAddress(null)).toBeNull();
    expect(stateFromAddress("R. A - XX, Brasil")).toBeNull();
  });
});

describe("stateFromCity", () => {
  it("reads a typed state code", () => {
    expect(stateFromCity("Contagem - MG")).toBe("MG");
    expect(stateFromCity("Juiz de Fora, mg")).toBe("MG");
  });

  it("reads a capital or a state name, without accents", () => {
    expect(stateFromCity("Savassi, Belo Horizonte")).toBe("MG");
    expect(stateFromCity("Belo Horizonte · Savassi")).toBe("MG");
    expect(stateFromCity("sao paulo")).toBe("SP");
    expect(stateFromCity("Bahia")).toBe("BA");
  });

  it("does not take a state name inside a city name", () => {
    expect(stateFromCity("Espírito Santo do Pinhal")).toBeNull();
  });

  it("returns null for a city it cannot place", () => {
    expect(stateFromCity("Contagem")).toBeNull();
    expect(stateFromCity("")).toBeNull();
  });
});

describe("searchState", () => {
  it("prefers the lead address over the typed city", () => {
    expect(searchState("Belo Horizonte", "Rua X, 1 - Centro, Vitória - ES, 29000-000")).toBe("ES");
  });

  it("falls back to the typed city", () => {
    expect(searchState("Belo Horizonte", null)).toBe("MG");
  });
});
