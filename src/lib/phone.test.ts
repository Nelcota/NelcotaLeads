import { describe, expect, it } from "vitest";
import { toE164, whatsappLink } from "./phone";

describe("toE164", () => {
  it("normalizes Brazilian mobile and landline numbers", () => {
    expect(toE164("(31) 99876-5432")).toBe("+5531998765432");
    expect(toE164("(31) 3274-1000")).toBe("+553132741000");
    expect(toE164("+55 11 91234-5678")).toBe("+5511912345678");
  });

  it("returns null for missing or invalid numbers", () => {
    expect(toE164(null)).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164("123")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link with an encoded message", () => {
    expect(whatsappLink("+5531998765432", "Olá, tudo bem?")).toBe(
      "https://wa.me/5531998765432?text=Ol%C3%A1%2C%20tudo%20bem%3F",
    );
    expect(whatsappLink("+5531998765432")).toBe("https://wa.me/5531998765432");
  });
});
