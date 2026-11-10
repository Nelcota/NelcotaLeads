import { describe, expect, it } from "vitest";
import {
  companiesLeftLabel,
  companiesLeftToday,
  googleRequestsFor,
  searchCostLabel,
  searchQuotaBlocker,
} from "./google-quota";

describe("googleRequestsFor", () => {
  it("uses one request per 20 companies", () => {
    expect([20, 40, 60].map(googleRequestsFor)).toEqual([1, 2, 3]);
    expect(googleRequestsFor(21)).toBe(2);
    expect(googleRequestsFor(0)).toBe(0);
  });
});

describe("companiesLeftToday", () => {
  it("turns the requests left into companies", () => {
    expect(companiesLeftToday({ used: 0, limit: 50 })).toBe(1000);
    expect(companiesLeftToday({ used: 49, limit: 50 })).toBe(20);
  });

  it("never goes below zero", () => {
    expect(companiesLeftToday({ used: 50, limit: 50 })).toBe(0);
    expect(companiesLeftToday({ used: 52, limit: 50 })).toBe(0);
    expect(companiesLeftToday({ used: 0, limit: 0 })).toBe(0);
  });
});

describe("labels", () => {
  it("says how many companies are left, with the pt-BR thousands dot", () => {
    expect(companiesLeftLabel({ used: 0, limit: 50 })).toBe(
      "Hoje dá para buscar mais 1.000 empresas",
    );
    expect(companiesLeftLabel({ used: 48, limit: 50 })).toBe(
      "Hoje dá para buscar mais 40 empresas",
    );
    expect(companiesLeftLabel({ used: 50, limit: 50 })).toBe("Limite de buscas de hoje atingido");
  });

  it("says what one search takes from today's companies", () => {
    expect(searchCostLabel(40, { used: 0, limit: 50 })).toBe(
      "Esta busca usa 40 de 1.000 empresas disponíveis hoje",
    );
  });

  it("never uses the word requisição", () => {
    const texts = [
      companiesLeftLabel({ used: 0, limit: 50 }),
      companiesLeftLabel({ used: 50, limit: 50 }),
      searchCostLabel(60, { used: 10, limit: 50 }),
      searchQuotaBlocker(60, { used: 50, limit: 50 }),
      searchQuotaBlocker(60, { used: 49, limit: 50 }),
    ];
    expect(texts.join(" ")).not.toMatch(/requisi/i);
  });
});

describe("searchQuotaBlocker", () => {
  it("lets a search start while the companies left cover it", () => {
    expect(searchQuotaBlocker(60, { used: 47, limit: 50 })).toBeNull();
  });

  it("asks for fewer companies, or for tomorrow when nothing is left", () => {
    expect(searchQuotaBlocker(60, { used: 49, limit: 50 })).toBe(
      "Hoje dá para buscar só mais 20 empresas. Escolha um número menor.",
    );
    expect(searchQuotaBlocker(20, { used: 50, limit: 50 })).toBe(
      "Limite de buscas de hoje atingido. Volte amanhã.",
    );
  });
});
