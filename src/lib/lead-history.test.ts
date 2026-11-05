import { describe, expect, it } from "vitest";
import { eventTime, historyLines, type HistoryEvent } from "./lead-history";

// 14:05 in Brazil (UTC-3).
const at = new Date("2026-11-03T17:05:00Z");
let next = 0;
const event = (overrides: Partial<HistoryEvent>): HistoryEvent => ({
  id: `e${(next += 1)}`,
  kind: "status",
  fromValue: null,
  toValue: null,
  userName: "Haniel",
  createdAt: at,
  ...overrides,
});

const texts = (events: HistoryEvent[]) => historyLines(events).map((line) => line.text);

describe("historyLines", () => {
  it("shows the time in Brazil", () => {
    expect(eventTime(at)).toBe("03/11 14:05");
  });

  it("describes a won deal with who and when, without its status twin", () => {
    const lines = historyLines([
      event({ kind: "won", toValue: "149000" }),
      event({ kind: "status", fromValue: "replied", toValue: "closed" }),
    ]);
    expect(lines).toEqual([
      { id: expect.any(String), text: "Fechado por R$ 1.490", meta: "Haniel · 03/11 14:05" },
    ]);
  });

  it("describes losses, stages, owners and status changes in Portuguese", () => {
    expect(
      texts([
        event({ kind: "lost", toValue: "price" }),
        event({ kind: "stage", fromValue: null, toValue: "meeting" }),
        event({ kind: "stage", fromValue: "proposal", toValue: null }),
        event({ kind: "status", fromValue: "contacted", toValue: "replied" }),
        event({ kind: "status", fromValue: "closed", toValue: "replied" }),
      ]),
    ).toEqual([
      "Encerrado: Preço alto",
      "Passou para Reunião",
      "Saiu de Proposta",
      "Passou para Respondeu",
      "Reaberto em Respondeu",
    ]);
  });

  it("names the person in an owner line, not again after it", () => {
    expect(historyLines([event({ kind: "owner", toValue: "u1" })])[0]).toMatchObject({
      text: "Assumido por Haniel",
      meta: "03/11 14:05",
    });
    expect(
      texts([event({ kind: "owner", fromValue: "u1", toValue: null, userName: null })]),
    ).toEqual(["Liberado"]);
  });

  it("keeps a status change that is not paired with a deal", () => {
    expect(
      texts([
        event({ kind: "status", fromValue: "new", toValue: "discarded" }),
        event({
          kind: "lost",
          toValue: "price",
          createdAt: new Date(at.getTime() + 60_000),
        }),
      ]),
    ).toEqual(["Passou para Descartado", "Encerrado: Preço alto"]);
  });

  it("describes meetings and proposals", () => {
    expect(
      texts([
        event({ kind: "meeting", toValue: "2026-11-05T13:00:00.000Z" }),
        event({ kind: "meeting", fromValue: "2026-11-05T13:00:00.000Z", toValue: "cancelled" }),
        event({ kind: "proposal", fromValue: "email", toValue: "118000" }),
        event({ kind: "proposal", fromValue: null, toValue: "99000" }),
      ]),
    ).toEqual([
      "Reunião marcada para 05/11 10:00",
      "Reunião cancelada",
      "Proposta para envio por e-mail: R$ 1.180",
      "Proposta montada: R$ 990",
    ]);
  });
});
