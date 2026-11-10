import { describe, expect, it } from "vitest";
import {
  appendDrafts,
  coldRemaining,
  dispatchBlocker,
  dispatchButtonLabel,
  leadsWithoutDraft,
  selectReadyLabel,
  writeDraftsLabel,
} from "./dispatch-review";

describe("dispatch review", () => {
  it("asks for a selection before the review opens", () => {
    expect(dispatchBlocker({ selected: 0, sendable: 0, limit: 100 })).toBe(
      "Selecione os leads para disparar",
    );
    expect(dispatchBlocker({ selected: 2, sendable: 0, limit: 100 })).toBe(
      "Nenhum lead selecionado pode receber o primeiro e-mail",
    );
    expect(dispatchBlocker({ selected: 120, sendable: 101, limit: 100 })).toBe(
      "Selecione até 100 leads com e-mail por disparo",
    );
    expect(dispatchBlocker({ selected: 3, sendable: 2, limit: 100 })).toBeNull();
  });

  it("labels the buttons with their counts", () => {
    expect(dispatchButtonLabel(0)).toBe("Disparar (0)");
    expect(dispatchButtonLabel(3)).toBe("Disparar (3)");
    expect(selectReadyLabel(5)).toBe("Selecionar prontos (5)");
    expect(writeDraftsLabel(1)).toBe("Escrever 1 e-mail");
    expect(writeDraftsLabel(4)).toBe("Escrever 4 e-mails");
  });

  it("only asks the AI for recipients without a draft or an earlier skip", () => {
    expect(leadsWithoutDraft(["a", "b", "c"], [], [])).toEqual(["a", "b", "c"]);
    expect(leadsWithoutDraft(["a", "b", "c"], [{ leadId: "b" }], [{ leadId: "c" }])).toEqual(["a"]);
    expect(leadsWithoutDraft(["a"], [{ leadId: "a" }], [])).toEqual([]);
  });

  it("counts today's room for first e-mails from the cold limit, sends and queue", () => {
    expect(coldRemaining({ coldLimit: 24, sentToday: 0, queuedCold: 0 })).toBe(24);
    expect(coldRemaining({ coldLimit: 24, sentToday: 5, queuedCold: 4 })).toBe(15);
    expect(coldRemaining({ coldLimit: 24, sentToday: 20, queuedCold: 10 })).toBe(0);
  });

  it("appends only drafts not already in the review", () => {
    const first = { id: "d1", leadId: "a" };
    const second = { id: "d2", leadId: "b" };
    expect(appendDrafts([first], [first, second])).toEqual([first, second]);
    expect(appendDrafts([], [second])).toEqual([second]);
  });
});
