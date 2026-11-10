import { describe, expect, it } from "vitest";
import {
  ANALYSIS_FAILED,
  ANALYSIS_NOT_CONFIGURED,
  analysisErrorMessage,
  SEARCH_FAILED,
  SEARCH_NOT_CONFIGURED,
  searchErrorMessage,
  GOOGLE_LIMIT_REACHED,
  googleLimitPartialMessage,
  searchFailureText,
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
    expect(searchErrorMessage(new Error("Google Places respondeu 429: RESOURCE_EXHAUSTED"))).toBe(
      GOOGLE_LIMIT_REACHED,
    );
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

describe("searchFailureText", () => {
  const limit =
    "Limite diário de requisições ao Google atingido. A busca não foi feita; tente amanhã.";
  // 2026-11-05 14:00 in Brazil.
  const searchedAt = new Date("2026-11-05T17:00:00Z");

  it("keeps the message on the day of the search, in the words without requisição", () => {
    expect(searchFailureText(GOOGLE_LIMIT_REACHED, searchedAt, "2026-11-05")).toBe(
      GOOGLE_LIMIT_REACHED,
    );
    expect(searchFailureText(limit, searchedAt, "2026-11-05")).toBe(GOOGLE_LIMIT_REACHED);
  });

  it("shows the date instead of amanhã on a later day", () => {
    expect(searchFailureText(limit, searchedAt, "2026-11-09")).toBe(
      "Limite do Google atingido em 05/11",
    );
    expect(searchFailureText(GOOGLE_LIMIT_REACHED, searchedAt, "2026-11-09")).toBe(
      "Limite do Google atingido em 05/11",
    );
  });

  it("uses the Brazil day of the search, not the UTC one", () => {
    // 2026-11-05 22:30 in Brazil is already the 6th in UTC.
    const lateEvening = new Date("2026-11-06T01:30:00Z");
    expect(searchFailureText(limit, lateEvening, "2026-11-05")).toBe(GOOGLE_LIMIT_REACHED);
  });

  it("leaves other failures as they are", () => {
    expect(searchFailureText(SEARCH_FAILED, searchedAt, "2026-11-09")).toBe(SEARCH_FAILED);
    const partial =
      "Limite diário de requisições ao Google atingido: coletadas 0 de até 60 empresas.";
    expect(searchFailureText(partial, searchedAt, "2026-11-09")).toBe(
      googleLimitPartialMessage(0, 60),
    );
    expect(googleLimitPartialMessage(0, 60)).toBe(
      "Limite de buscas do Google de hoje atingido: coletadas 0 de até 60 empresas.",
    );
    expect(searchFailureText(null, searchedAt, "2026-11-09")).toBeNull();
  });
});
