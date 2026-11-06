import { describe, expect, it } from "vitest";
import { buildProposalItems } from "./proposal";
import {
  meetingInviteEmail,
  proposalEmail,
  SALES_SIGNATURE,
  salesEmailsEnabled,
} from "./sales-email";

describe("SALES_EMAILS_ENABLED", () => {
  it("is off unless set to true", () => {
    expect(salesEmailsEnabled(undefined)).toBe(false);
    expect(salesEmailsEnabled("")).toBe(false);
    expect(salesEmailsEnabled("false")).toBe(false);
    expect(salesEmailsEnabled("yes")).toBe(false);
    expect(salesEmailsEnabled("true")).toBe(true);
    expect(salesEmailsEnabled(" TRUE ")).toBe(true);
    expect(salesEmailsEnabled("1")).toBe(true);
  });
});

describe("sales e-mails", () => {
  it("writes the invite in Brasília time, signed by the team", () => {
    const email = meetingInviteEmail({
      leadName: "Clínica Sorriso",
      // 10:00 in Brazil.
      startsAt: new Date("2026-11-05T13:00:00Z"),
      kind: "call",
      note: "",
    });
    expect(email.subject).toBe("Nossa conversa: quinta-feira, 05/11, às 10:00");
    expect(email.body).toContain("por ligação");
    expect(email.body.endsWith(`\n\n${SALES_SIGNATURE}`)).toBe(true);
    expect(SALES_SIGNATURE).toBe("Equipe Nelcota");
  });

  it("lists the proposal's lines, total and validity", () => {
    const items = buildProposalItems(
      { name: "Site institucional", priceCents: 99_000, monthly: false },
      [{ name: "Manutenção mensal", priceCents: 12_000, monthly: true }],
      [],
    );
    const email = proposalEmail({ leadName: "Clínica", items, validDays: 15, today: "2026-11-03" });
    expect(email.body).toContain("- Site institucional: R$ 990");
    expect(email.body).toContain("- Manutenção mensal: R$ 120/mês");
    expect(email.body).toContain("Total: R$ 1.110 (R$ 120 deste valor se repetem todo mês).");
    expect(email.body).toContain("válida por 15 dias, até 18/11/2026");
    expect(email.body.endsWith("Equipe Nelcota")).toBe(true);
  });
});
