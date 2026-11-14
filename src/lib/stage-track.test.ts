import { describe, expect, it } from "vitest";
import type { HistoryEvent } from "./lead-history";
import { lostStageStep, stageReason } from "./stage-track";

const at = new Date("2026-11-12T17:32:00Z");

function event(overrides: Partial<HistoryEvent>): HistoryEvent {
  return {
    id: "e1",
    kind: "status",
    fromValue: null,
    toValue: null,
    userName: null,
    createdAt: at,
    ...overrides,
  };
}

describe("stageReason", () => {
  it("returns null when nothing moved the lead", () => {
    expect(stageReason([])).toBeNull();
    expect(stageReason([event({ kind: "owner", toValue: "u1", userName: "Haniel" })])).toBeNull();
  });

  it("says the stage moved on its own when no person did it", () => {
    const reason = stageReason([event({ fromValue: "contacted", toValue: "replied" })]);
    expect(reason?.auto).toBe(true);
    expect(reason?.text).toBe("Atualizada sozinha: passou para Respondeu em 12/11 14:32");
  });

  it("names the person who moved it", () => {
    const reason = stageReason([
      event({ kind: "stage", toValue: "meeting", userName: "Phellipe" }),
    ]);
    expect(reason?.auto).toBe(false);
    expect(reason?.text).toBe("Passou para Reunião por Phellipe em 12/11 14:32");
  });

  it("uses the newest move and skips taking the lead", () => {
    const reason = stageReason([
      event({ id: "e3", kind: "owner", toValue: "u1", userName: "Haniel" }),
      event({ id: "e2", kind: "proposal", toValue: "240000", userName: "Haniel" }),
      event({ id: "e1", fromValue: "new", toValue: "contacted" }),
    ]);
    expect(reason?.text).toContain("Proposta montada");
  });
});

describe("lostStageStep", () => {
  it("is the first step when no event says where it stopped", () => {
    expect(lostStageStep([], null)).toBe(0);
  });

  it("is the status the lead had before it was discarded", () => {
    const events = [event({ fromValue: "contacted", toValue: "discarded" })];
    expect(lostStageStep(events, null)).toBe(1);
  });

  it("keeps the sale stage of a lead lost while negotiating", () => {
    const events = [event({ fromValue: "replied", toValue: "discarded" })];
    expect(lostStageStep(events, "proposal")).toBe(4);
    expect(lostStageStep(events, null)).toBe(2);
  });
});
