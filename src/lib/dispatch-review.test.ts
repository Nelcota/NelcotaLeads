import { describe, expect, it } from "vitest";
import {
  appendDrafts,
  coldRemaining,
  coldRoomSummary,
  dispatchBlocker,
  dispatchButtonLabel,
  dispatchLabel,
  isSavableDraft,
  leadsWithoutDraft,
  missingLine,
  reviewBusy,
  reviewTitle,
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
  it("shows today's room only once it is known, and flags drafts that spill to tomorrow", () => {
    expect(coldRoomSummary(undefined, 3)).toBeNull();
    const room = { coldLimit: 24, sentToday: 20, queuedCold: 2 };
    expect(coldRoomSummary(room, 2)).toEqual({ remaining: 2, limit: 24, spillsOver: false });
    expect(coldRoomSummary(room, 3)).toEqual({ remaining: 2, limit: 24, spillsOver: true });
  });

  it("waits while a draft is removed, rewritten or written", () => {
    expect(reviewBusy({ removing: false, rewriting: false, writing: false })).toBe(false);
    expect(reviewBusy({ removing: true, rewriting: false, writing: false })).toBe(true);
    expect(reviewBusy({ removing: false, rewriting: true, writing: false })).toBe(true);
    expect(reviewBusy({ removing: false, rewriting: false, writing: true })).toBe(true);
  });

  it("saves only a draft with both subject and body", () => {
    expect(isSavableDraft({ subject: "Oi", body: "Texto" })).toBe(true);
    expect(isSavableDraft({ subject: "  ", body: "Texto" })).toBe(false);
    expect(isSavableDraft({ subject: "Oi", body: "" })).toBe(false);
  });

  it("titles and labels the review by what is going on", () => {
    expect(reviewTitle({ writing: true, count: 2 })).toBe("Escrevendo os e-mails…");
    expect(reviewTitle({ writing: false, count: 0 })).toBe("Revisar disparo");
    expect(reviewTitle({ writing: false, count: 1 })).toBe("Disparar 1 e-mail");
    expect(missingLine(1)).toBe("1 destinatário ainda sem e-mail escrito.");
    expect(missingLine(3)).toBe("3 destinatários ainda sem e-mail escrito.");
    const idle = { mailConfigured: true, dispatching: false, removing: false, rewriting: false };
    expect(dispatchLabel({ ...idle, mailConfigured: false, count: 2 })).toBe(
      "Caixa de e-mail ainda não conectada",
    );
    expect(dispatchLabel({ ...idle, dispatching: true, count: 2 })).toBe("Colocando na fila…");
    expect(dispatchLabel({ ...idle, removing: true, count: 2 })).toBe("Tirando do disparo…");
    expect(dispatchLabel({ ...idle, rewriting: true, count: 2 })).toBe("Gerando outra versão…");
    expect(dispatchLabel({ ...idle, count: 2 })).toBe("Disparar 2 e-mails");
  });
});
