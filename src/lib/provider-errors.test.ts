import { describe, expect, it } from "vitest";
import {
  ANALYSIS_FAILED,
  ANALYSIS_NOT_CONFIGURED,
  analysisErrorMessage,
  SEARCH_FAILED,
  SEARCH_NOT_CONFIGURED,
  searchErrorMessage,
} from "./provider-errors";

describe("searchErrorMessage", () => {
  it("never shows Google's own response text", () => {
    const raw = 'Google Places respondeu 400: {"error":{"message":"API key not valid. key=AIza…"}}';
    expect(searchErrorMessage(new Error(raw))).toBe(SEARCH_FAILED);
    expect(searchErrorMessage(new TypeError("fetch failed"))).toBe(SEARCH_FAILED);
    expect(searchErrorMessage({ message: "object" })).toBe(SEARCH_FAILED);
  });

  it("keeps the daily-limit wording the status screen recognizes", () => {
    const own =
      "Limite diário de requisições ao Google atingido. A busca não foi feita; tente amanhã.";
    expect(searchErrorMessage(new Error(own))).toBe(own);
    expect(
      searchErrorMessage(new Error("Google Places respondeu 429: RESOURCE_EXHAUSTED")),
    ).toMatch(/^Limite diário de requisições ao Google/);
  });

  it("says when the search is not configured", () => {
    expect(searchErrorMessage(new Error("GOOGLE_PLACES_API_KEY não configurada."))).toBe(
      SEARCH_NOT_CONFIGURED,
    );
  });
});

describe("analysisErrorMessage", () => {
  const known = ["Falha após todas as tentativas", "O lead já está sendo analisado"];

  it("keeps the app's own messages and hides provider text", () => {
    expect(analysisErrorMessage(new Error(known[0]), known)).toBe(known[0]);
    expect(
      analysisErrorMessage(new Error("Insufficient Balance (402) request_id=abc"), known),
    ).toBe(ANALYSIS_FAILED);
    expect(analysisErrorMessage(new Error('[{"code":"too_big","path":["summary"]}]'), known)).toBe(
      ANALYSIS_FAILED,
    );
    expect(analysisErrorMessage(new Error("DEEPSEEK_API_KEY não configurada."), known)).toBe(
      ANALYSIS_NOT_CONFIGURED,
    );
  });
});
