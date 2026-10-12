import { describe, expect, it } from "vitest";
import { assertTransition, LEAD_TRANSITIONS, leadPatch, UNSUBSCRIBED_MESSAGE } from "./lead-status";

const now = new Date("2026-10-11T15:00:00Z");
const fresh = { status: "new" as const, unsubscribedAt: null, contactedAt: null, followUpOn: null };

describe("leadPatch", () => {
  it("lets a conversation be ended from any status", () => {
    expect(() => leadPatch(fresh, { id: "1", status: "closed" }, now, "2026-10-11")).toThrow(
      "Não é possível mudar o lead",
    );
    expect(
      leadPatch(fresh, { id: "1", status: "closed" }, now, "2026-10-11", { anyStatus: true }),
    ).toMatchObject({ status: "closed", followUpOn: null });
  });

  it("records the contact and schedules a follow-up in three days", () => {
    expect(leadPatch(fresh, { id: "1", status: "contacted" }, now, "2026-10-11")).toEqual({
      status: "contacted",
      contactedAt: now,
      followUpOn: "2026-10-14",
      discardReason: null,
      discardedAt: null,
    });
  });

  it("keeps an explicit or existing follow-up day", () => {
    expect(
      leadPatch(
        fresh,
        { id: "1", status: "contacted", followUpOn: "2026-10-20" },
        now,
        "2026-10-11",
      ).followUpOn,
    ).toBe("2026-10-20");
    const earlier = new Date("2026-10-01T12:00:00Z");
    const patch = leadPatch(
      { status: "contacted", unsubscribedAt: null, contactedAt: earlier, followUpOn: "2026-10-12" },
      { id: "1", status: "contacted" },
      now,
      "2026-10-11",
    );
    expect(patch).toEqual({
      status: "contacted",
      contactedAt: earlier,
      discardReason: null,
      discardedAt: null,
    });
  });

  it("clears the follow-up when the lead leaves the pipeline", () => {
    expect(
      leadPatch(
        { status: "replied", unsubscribedAt: null, contactedAt: now, followUpOn: "2026-10-14" },
        { id: "1", status: "closed" },
        now,
        "2026-10-11",
      ),
    ).toEqual({ status: "closed", followUpOn: null, discardReason: null, discardedAt: null });
  });

  it("leaves other updates untouched", () => {
    expect(leadPatch(fresh, { id: "1", notes: "oi" }, now, "2026-10-11")).toEqual({ notes: "oi" });
  });
});

const lead = (status: keyof typeof LEAD_TRANSITIONS, unsubscribedAt: Date | null = null) => ({
  status,
  unsubscribedAt,
});

describe("assertTransition", () => {
  it("allows the moves the lead screen offers", () => {
    expect(() => assertTransition(lead("new"), "contacted")).not.toThrow();
    expect(() => assertTransition(lead("contacted"), "new")).not.toThrow(); // undo
    expect(() => assertTransition(lead("contacted"), "replied")).not.toThrow();
    expect(() => assertTransition(lead("replied"), "closed")).not.toThrow();
    expect(() => assertTransition(lead("closed"), "replied")).not.toThrow(); // reopen
    expect(() => assertTransition(lead("discarded"), "new")).not.toThrow();
    expect(() => assertTransition(lead("replied"), "replied")).not.toThrow();
    expect(() => assertTransition(lead("new"), undefined)).not.toThrow();
  });

  it("rejects jumps the pipeline does not have", () => {
    expect(() => assertTransition(lead("new"), "closed")).toThrow(
      'Não é possível mudar o lead de "Novo" para "Fechado".',
    );
    expect(() => assertTransition(lead("discarded"), "replied")).toThrow(/Descartado/);
    expect(() => assertTransition(lead("closed"), "new")).toThrow(/Fechado/);
  });

  it("never puts an unsubscribed lead back into outreach", () => {
    const gone = lead("discarded", now);
    for (const status of ["new", "contacted", "replied"] as const) {
      expect(() => assertTransition(gone, status)).toThrow(UNSUBSCRIBED_MESSAGE);
    }
    expect(() => assertTransition(lead("replied", now), "closed")).not.toThrow();
  });

  it("is enforced by leadPatch", () => {
    expect(() => leadPatch(fresh, { id: "1", status: "replied" }, now, "2026-10-11")).toThrow(
      /Respondeu/,
    );
  });
});
