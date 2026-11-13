import { describe, expect, it } from "vitest";
import { agoText, freeLeadInfo } from "./free-lead";

const now = new Date("2026-11-12T18:00:00-03:00");

describe("free lead time line", () => {
  it("counts minutes and hours today, then days, then the date", () => {
    expect(agoText(new Date("2026-11-12T17:59:40-03:00"), now)).toBe("agora");
    expect(agoText(new Date("2026-11-12T17:35:00-03:00"), now)).toBe("há 25 min");
    expect(agoText(new Date("2026-11-12T16:00:00-03:00"), now)).toBe("há 2 h");
    expect(agoText(new Date("2026-11-11T23:50:00-03:00"), now)).toBe("ontem");
    expect(agoText(new Date("2026-11-07T10:00:00-03:00"), now)).toBe("há 5 dias");
    expect(agoText(new Date("2026-10-13T10:00:00-03:00"), now)).toBe("há 30 dias");
    expect(agoText(new Date("2026-10-11T10:00:00-03:00"), now)).toBe("11/10");
  });

  it("handles the edges: past midnight, the future, another year, a bad date", () => {
    const justAfterMidnight = new Date("2026-11-13T00:10:00-03:00");
    expect(agoText(new Date("2026-11-12T23:50:00-03:00"), justAfterMidnight)).toBe("há 20 min");
    expect(agoText(new Date("2026-11-12T22:00:00-03:00"), justAfterMidnight)).toBe("ontem");
    expect(agoText(new Date("2026-11-12T18:05:00-03:00"), now)).toBe("agora");
    expect(agoText(new Date("2025-10-11T10:00:00-03:00"), now)).toBe("11/10/2025");
    expect(agoText(new Date(Number.NaN), now)).toBe("agora");
  });

  it("says when a lead answered, got the e-mail or arrived, without repeating the stage", () => {
    const twoHours = new Date("2026-11-12T16:00:00-03:00");
    const created = new Date("2026-11-11T09:00:00-03:00");
    expect(
      freeLeadInfo({ status: "replied", createdAt: created, lastEmailAt: twoHours }, now),
    ).toBe("há 2 h");
    expect(
      freeLeadInfo({ status: "contacted", createdAt: created, lastEmailAt: twoHours }, now),
    ).toBe("e-mail há 2 h");
    // Our later e-mail does not move "when it answered".
    const answered = new Date("2026-11-11T15:00:00-03:00");
    expect(
      freeLeadInfo(
        { status: "replied", createdAt: created, lastEmailAt: twoHours, repliedAt: answered },
        now,
      ),
    ).toBe("ontem");
    expect(freeLeadInfo({ status: "new", createdAt: created, lastEmailAt: null }, now)).toBe(
      "chegou ontem",
    );
    expect(freeLeadInfo({ status: "contacted", createdAt: created, lastEmailAt: null }, now)).toBe(
      "",
    );
  });
});
