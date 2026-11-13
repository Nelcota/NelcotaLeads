import { describe, expect, it } from "vitest";
import { flagOn, inviteEmailText, inviteInputSchema, signUpUrl } from "./team";

describe("team flags and labels", () => {
  it("turns a flag on only with true or 1", () => {
    expect(flagOn("true")).toBe(true);
    expect(flagOn(" TRUE ")).toBe(true);
    expect(flagOn("1")).toBe(true);
    expect(flagOn(undefined)).toBe(false);
    expect(flagOn("false")).toBe(false);
    expect(flagOn("yes")).toBe(false);
  });

  it("builds the sign-up link and the invite text signed by the team", () => {
    const link = signUpUrl("https://leads.nelcota.test");
    expect(link).toBe("https://leads.nelcota.test/criar-conta");
    const text = inviteEmailText(link);
    expect(text.body).toContain(link);
    expect(text.body.endsWith("Equipe Nelcota")).toBe(true);
  });

  it("reads the invited e-mail in lowercase", () => {
    expect(inviteInputSchema.parse({ email: " Bia@Nelcota.TEST " })).toEqual({
      email: "bia@nelcota.test",
    });
    expect(inviteInputSchema.safeParse({ email: "bia" }).success).toBe(false);
  });
});
