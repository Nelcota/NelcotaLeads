import { describe, expect, it } from "vitest";
import { friendlyMessage } from "./mutation-toasts";

describe("friendlyMessage", () => {
  it.each([
    "Lead não encontrado",
    "O limite de e-mails de hoje acabou. Tente amanhã.",
    "O servidor SMTP recusou o envio.",
    "Já está saindo, não dá mais para cancelar.",
  ])("keeps the server's message: %s", (message) => {
    expect(friendlyMessage(new Error(message))).toBe(message);
  });

  it.each([
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
    "Load failed",
    "Unexpected end of JSON input",
    "Cannot read properties of undefined (reading 'id')",
    "D1_ERROR: no such table: emails",
    '[\n  {\n    "code": "too_small"\n  }\n]',
    "Internal Server Error",
    "x".repeat(300),
    "lowercase technical detail",
    "",
  ])("hides technical text: %s", (message) => {
    expect(friendlyMessage(new Error(message))).toBeNull();
  });

  it("ignores values that are not errors", () => {
    expect(friendlyMessage("Lead não encontrado")).toBeNull();
    expect(friendlyMessage(undefined)).toBeNull();
  });
});
