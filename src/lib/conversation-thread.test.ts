import { describe, expect, it } from "vitest";
import { dayLabel, messageInstant, shownMessages, withDayBreaks } from "./conversation-thread";

// Noon UTC is 09:00 in Brazil, so these instants stay on the day they name.
const at = (day: string) => new Date(`${day}T12:00:00Z`);
const email = (day: string, extra: { sentAt?: Date | null; sendAfter?: Date | null } = {}) => ({
  sentAt: extra.sentAt === undefined ? at(day) : extra.sentAt,
  sendAfter: extra.sendAfter ?? null,
  createdAt: at(day),
});

describe("dayLabel", () => {
  it("names today and yesterday", () => {
    expect(dayLabel("2026-11-08", "2026-11-08")).toBe("Hoje");
    expect(dayLabel("2026-11-07", "2026-11-08")).toBe("Ontem");
  });

  it("uses the short weekday and dd/mm for other days", () => {
    expect(dayLabel("2026-11-05", "2026-11-08")).toBe("Qui, 05/11");
    expect(dayLabel("2026-11-07", "2026-11-09")).toBe("Sáb, 07/11");
    expect(dayLabel("2026-11-10", "2026-11-08")).toBe("Ter, 10/11");
  });
});

describe("messageInstant", () => {
  it("prefers when it went out, then when it will, then when it was written", () => {
    expect(messageInstant(email("2026-11-05"))).toEqual(at("2026-11-05"));
    expect(
      messageInstant(email("2026-11-05", { sentAt: null, sendAfter: at("2026-11-10") })),
    ).toEqual(at("2026-11-10"));
    expect(messageInstant(email("2026-11-05", { sentAt: null }))).toEqual(at("2026-11-05"));
  });
});

describe("shownMessages", () => {
  const thread = [1, 2, 3, 4, 5, 6];

  it("keeps short threads whole", () => {
    expect(shownMessages([1, 2, 3, 4], false)).toEqual([1, 2, 3, 4]);
  });

  it("shows only the three newest of a long thread until expanded", () => {
    expect(shownMessages(thread, false)).toEqual([4, 5, 6]);
    expect(shownMessages(thread, true)).toEqual(thread);
  });
});

describe("withDayBreaks", () => {
  it("labels the first message of each day only", () => {
    const thread = [email("2026-11-05"), email("2026-11-07"), email("2026-11-07")];
    expect(withDayBreaks(thread, "2026-11-08").map((item) => item.dayBreak)).toEqual([
      "Qui, 05/11",
      "Ontem",
      null,
    ]);
  });

  it("has no breaks for an empty thread", () => {
    expect(withDayBreaks([], "2026-11-08")).toEqual([]);
  });
});
