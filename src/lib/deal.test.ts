import { describe, expect, it } from "vitest";
import { wonDealFromForm } from "./deal-form";
import { currentStageStep, isPriceHandoff, STAGE_STEPS, stageOfStep } from "./lead-stage";
import { formatCents, formatMoneyInput, MAX_DEAL_CENTS, parseMoneyInput } from "./money";
import { scoreLabel, scoreLevel } from "./score-label";

describe("money", () => {
  it("formats reais, with cents only when there are any", () => {
    expect(formatCents(149_000)).toBe("R$ 1.490");
    expect(formatCents(149_050)).toBe("R$ 1.490,50");
    expect(formatMoneyInput(149_000)).toBe("1.490,00");
  });

  it.each([
    ["1490", 149_000],
    ["1.490", 149_000],
    ["1.490,50", 149_050],
    ["R$ 1.490,5", 149_050],
    ["1490,50", 149_050],
    ["1490.50", 149_050],
    ["1.234.567,89", 123_456_789],
  ])("reads %s as %i cents", (text, cents) => {
    expect(parseMoneyInput(text)).toBe(cents);
  });

  it.each(["", "0", "0,00", "abc", "1,2,3", "1.4999", "-10", "12,345"])("refuses %j", (text) => {
    expect(parseMoneyInput(text)).toBeNull();
  });

  it("refuses more than the largest deal", () => {
    expect(parseMoneyInput(String(MAX_DEAL_CENTS / 100 + 1))).toBeNull();
  });
});

describe("score label", () => {
  it("is Alta from 60, Média from 30, Baixa below", () => {
    expect([scoreLabel(100), scoreLabel(60), scoreLabel(59)]).toEqual(["Alta", "Alta", "Média"]);
    expect([scoreLabel(30), scoreLabel(29), scoreLabel(0)]).toEqual(["Média", "Baixa", "Baixa"]);
    expect(scoreLevel(60)).toBe("high");
  });
});

const step = (status: Parameters<typeof currentStageStep>[0]) =>
  STAGE_STEPS[currentStageStep(status, null) ?? -1];

describe("stage bar", () => {
  it("follows the status, then the sales stage while replied", () => {
    expect(step("new")).toBe("Novo");
    expect(step("contacted")).toBe("Contatado");
    expect(step("replied")).toBe("Respondeu");
    expect(STAGE_STEPS[currentStageStep("replied", "meeting") ?? -1]).toBe("Reunião");
    expect(STAGE_STEPS[currentStageStep("replied", "proposal") ?? -1]).toBe("Proposta");
    expect(STAGE_STEPS[currentStageStep("closed", "proposal") ?? -1]).toBe("Fechado");
    // A stage left on a lead that went back to contacted does not count.
    expect(STAGE_STEPS[currentStageStep("contacted", "meeting") ?? -1]).toBe("Contatado");
  });

  it("has no step for a lead that ended without a deal", () => {
    expect(currentStageStep("discarded", null)).toBeNull();
  });

  it("maps the movable steps to sales stages", () => {
    expect(STAGE_STEPS.map((_, index) => stageOfStep(index))).toEqual([
      undefined,
      undefined,
      null,
      "meeting",
      "proposal",
      undefined,
    ]);
  });

  it("spots a hand-off about price", () => {
    expect(isPriceHandoff("Pediu preço")).toBe(true);
    expect(isPriceHandoff("Quer saber os valores")).toBe(true);
    expect(isPriceHandoff("Pediu orçamento")).toBe(true);
    expect(isPriceHandoff("Quer marcar reunião")).toBe(false);
    expect(isPriceHandoff(null)).toBe(false);
  });
});

describe("wonDealFromForm", () => {
  const today = "2026-11-03";
  it("turns the fields into a deal", () => {
    expect(wonDealFromForm({ value: "1.490", closedOn: today, service: " Site " }, today)).toEqual({
      ok: true,
      deal: { valueCents: 149_000, closedOn: today, service: "Site" },
    });
  });

  it("explains what is missing or wrong", () => {
    const form = { value: "1490", closedOn: today, service: "Site" };
    expect(wonDealFromForm({ ...form, value: "0" }, today)).toMatchObject({ ok: false });
    expect(wonDealFromForm({ ...form, closedOn: "" }, today)).toMatchObject({ ok: false });
    expect(wonDealFromForm({ ...form, closedOn: "2026-11-04" }, today)).toEqual({
      ok: false,
      error: "A data do fechamento não pode ser no futuro.",
    });
    expect(wonDealFromForm({ ...form, service: "  " }, today)).toMatchObject({ ok: false });
    expect(wonDealFromForm({ ...form, service: "x".repeat(121) }, today)).toMatchObject({
      ok: false,
    });
  });
});
