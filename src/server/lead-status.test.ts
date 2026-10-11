import { describe, expect, it } from "vitest";
import { leadPatch } from "./lead-status";

const now = new Date("2026-10-11T15:00:00Z");
const fresh = { contactedAt: null, followUpOn: null };

describe("leadPatch", () => {
  it("records the contact and schedules a follow-up in three days", () => {
    expect(leadPatch(fresh, { id: "1", status: "contacted" }, now, "2026-10-11")).toEqual({
      status: "contacted",
      contactedAt: now,
      followUpOn: "2026-10-14",
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
      { contactedAt: earlier, followUpOn: "2026-10-12" },
      { id: "1", status: "contacted" },
      now,
      "2026-10-11",
    );
    expect(patch).toEqual({ status: "contacted", contactedAt: earlier });
  });

  it("clears the follow-up when the lead leaves the pipeline", () => {
    expect(
      leadPatch(
        { contactedAt: now, followUpOn: "2026-10-14" },
        { id: "1", status: "closed" },
        now,
        "2026-10-11",
      ),
    ).toEqual({ status: "closed", followUpOn: null });
  });

  it("leaves other updates untouched", () => {
    expect(leadPatch(fresh, { id: "1", notes: "oi" }, now, "2026-10-11")).toEqual({ notes: "oi" });
  });
});
