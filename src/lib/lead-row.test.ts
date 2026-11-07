import { describe, expect, it } from "vitest";
import {
  isFresh,
  isReadyToDispatch,
  leadStage,
  nextStatus,
  nextStep,
  scoreReasons,
  type LeadRowFacts,
} from "./lead-row";

const now = new Date("2026-11-07T15:00:00-03:00");
const today = "2026-11-07";

function lead(patch: Partial<LeadRowFacts>): LeadRowFacts {
  return {
    status: "new",
    salesStage: null,
    analysisStatus: "done",
    score: 70,
    website: null,
    email: "a@b.test",
    unsubscribedAt: null,
    followUpOn: null,
    contactedAt: null,
    lastEmailAt: null,
    lastReplyAt: null,
    nextMeetingAt: null,
    createdAt: new Date("2026-11-01T12:00:00Z"),
    signals: ["Sem site", "Poucas avaliações", "Outro"],
    ...patch,
  };
}

describe("nextStep", () => {
  it("shows an overdue follow-up in red, counted in days", () => {
    const step = nextStep(
      lead({ status: "contacted", followUpOn: "2026-11-05" }),
      today,
      now,
      "followup",
    );
    expect(step).toEqual({ text: "Atrasado 2 dias", color: "var(--red)" });
  });

  it("shows today's follow-up in orange", () => {
    expect(
      nextStep(lead({ status: "replied", followUpOn: today }), today, now, "followup")?.text,
    ).toBe("Retorno hoje");
  });

  it("shows when the last e-mail went out in Aguardando, even when the return is late", () => {
    const step = nextStep(
      lead({
        status: "contacted",
        followUpOn: "2026-11-01",
        lastEmailAt: new Date("2026-11-04T15:00:00-03:00"),
      }),
      today,
      now,
      "waiting",
    );
    expect(step?.text).toBe("Enviado há 3 dias");
  });

  it("shows the next meeting first in Em conversa, then the last reply", () => {
    const meeting = lead({
      status: "replied",
      nextMeetingAt: new Date("2026-11-08T10:00:00-03:00"),
    });
    expect(nextStep(meeting, today, now, "talking")?.text).toBe("Reunião amanhã 10:00");
    const reply = lead({ status: "replied", lastReplyAt: new Date("2026-11-07T13:00:00-03:00") });
    expect(nextStep(reply, today, now, "talking")?.text).toBe("Respondeu há 2h");
  });

  it("has nothing for a new lead", () => {
    expect(nextStep(lead({}), today, now)).toBeNull();
  });
});

describe("lead row helpers", () => {
  it("reads the sales stage only while the lead replied", () => {
    expect(leadStage({ status: "replied", salesStage: "proposal" })).toBe("proposal");
    expect(leadStage({ status: "closed", salesStage: "proposal" })).toBe("closed");
  });

  it("moves forward one step from the row, never into the sales forms", () => {
    expect(nextStatus("new")).toBe("contacted");
    expect(nextStatus("contacted")).toBe("replied");
    expect(nextStatus("replied")).toBeNull();
  });

  it("is ready to dispatch only when new, analyzed and with an address", () => {
    expect(isReadyToDispatch(lead({}))).toBe(true);
    expect(isReadyToDispatch(lead({ email: null }))).toBe(false);
    expect(isReadyToDispatch(lead({ analysisStatus: "pending" }))).toBe(false);
    expect(isReadyToDispatch(lead({ status: "contacted" }))).toBe(false);
    expect(isReadyToDispatch(lead({ unsubscribedAt: new Date() }))).toBe(false);
  });

  it("counts a lead as fresh for 24 hours", () => {
    expect(isFresh(new Date(now.getTime() - 23 * 3_600_000), now)).toBe(true);
    expect(isFresh(new Date(now.getTime() - 25 * 3_600_000), now)).toBe(false);
  });

  it("gives the score with its two main reasons", () => {
    expect(scoreReasons(lead({ score: 71 }))).toBe("Nota 71 · Sem site · Poucas avaliações");
    expect(scoreReasons(lead({ score: null }))).toBeUndefined();
  });
});
