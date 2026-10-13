import { describe, expect, it } from "vitest";
import { contactPatch } from "./lead-contact";

describe("contactPatch", () => {
  it("stores e-mails trimmed and lowercase, and clears an empty one", () => {
    expect(contactPatch("email", "  Contato@Padaria.COM.br ")).toEqual({
      email: "contato@padaria.com.br",
    });
    expect(contactPatch("email", "")).toEqual({ email: null });
    expect(() => contactPatch("email", "contato@")).toThrow("E-mail inválido");
  });

  it("keeps the typed phone and its E.164 form", () => {
    expect(contactPatch("phone", "(31) 99876-5432")).toEqual({
      phone: "(31) 99876-5432",
      phoneE164: "+5531998765432",
    });
    expect(contactPatch("phone", " ")).toEqual({ phone: null, phoneE164: null });
    expect(() => contactPatch("phone", "123")).toThrow("Telefone inválido");
  });

  it("accepts a site without the scheme and refuses anything but http(s)", () => {
    expect(contactPatch("website", "padaria.com.br")).toEqual({
      website: "https://padaria.com.br/",
      siteStatus: "pending",
    });
    expect(contactPatch("website", "http://padaria.com.br/menu")).toMatchObject({
      website: "http://padaria.com.br/menu",
    });
    expect(contactPatch("website", "")).toEqual({ website: null, siteStatus: "none" });
    expect(() => contactPatch("website", "javascript:alert(1)")).toThrow("Site inválido");
    expect(() => contactPatch("website", "padaria")).toThrow("Site inválido");
  });

  it("requires a name and bounds every field", () => {
    expect(contactPatch("name", "  Padaria Sol ")).toEqual({ name: "Padaria Sol" });
    expect(() => contactPatch("name", "  ")).toThrow("Informe o nome");
    expect(() => contactPatch("name", "x".repeat(201))).toThrow("longo");
  });
});
