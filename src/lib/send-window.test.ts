import { describe, expect, it } from "vitest";
import {
  brazilHour,
  coldSendingOpen,
  compareByScore,
  isInsideSendWindow,
  nextWindowStart,
  sendSlots,
  windowSlot,
} from "./send-window";

const WINDOW = { start: 6, end: 18 };
const GAP = 8 * 60_000;
// Brazil is UTC-3: 09:00Z is 06:00 in Brazil.
const utc = (iso: string) => new Date(`${iso}Z`);

describe("send window", () => {
  it("reads the hour in Brazil time", () => {
    expect(brazilHour(utc("2026-11-03T02:30:00"))).toBe(23);
    expect(brazilHour(utc("2026-11-03T09:00:00"))).toBe(6);
  });

  it("opens at the start hour and closes at the end hour", () => {
    expect(isInsideSendWindow(utc("2026-11-03T08:59:00"), 6, 18)).toBe(false);
    expect(isInsideSendWindow(utc("2026-11-03T09:00:00"), 6, 18)).toBe(true);
    expect(isInsideSendWindow(utc("2026-11-03T20:59:00"), 6, 18)).toBe(true);
    expect(isInsideSendWindow(utc("2026-11-03T21:00:00"), 6, 18)).toBe(false);
  });

  it("finds the next opening today or tomorrow", () => {
    expect(nextWindowStart(utc("2026-11-03T05:00:00"), 6)).toEqual(utc("2026-11-03T09:00:00"));
    expect(nextWindowStart(utc("2026-11-03T12:00:00"), 6)).toEqual(utc("2026-11-04T09:00:00"));
    // 22:00 in Brazil is already 01:00 UTC of the next day.
    expect(nextWindowStart(utc("2026-11-04T01:00:00"), 6)).toEqual(utc("2026-11-04T09:00:00"));
  });

  it("keeps a slot inside the window and moves one outside it to the next opening", () => {
    expect(windowSlot(utc("2026-11-03T12:00:00"), WINDOW)).toEqual(utc("2026-11-03T12:00:00"));
    expect(windowSlot(utc("2026-11-03T22:00:00"), WINDOW)).toEqual(utc("2026-11-04T09:00:00"));
  });

  it("spaces slots by the gap and carries the overflow to the next day", () => {
    const slots = sendSlots(utc("2026-11-03T20:45:00"), 3, GAP, WINDOW);
    expect(slots).toEqual([
      utc("2026-11-03T20:45:00"),
      utc("2026-11-03T20:53:00"),
      utc("2026-11-04T09:00:00"),
    ]);
    expect(sendSlots(utc("2026-11-03T12:00:00"), 0, GAP, WINDOW)).toEqual([]);
  });

  it("is closed while paused, even inside the window", () => {
    const now = utc("2026-11-03T12:00:00");
    expect(coldSendingOpen({ ...WINDOW, pausedAt: null }, now)).toBe(true);
    expect(coldSendingOpen({ ...WINDOW, pausedAt: now }, now)).toBe(false);
    expect(coldSendingOpen({ ...WINDOW, pausedAt: null }, utc("2026-11-03T23:00:00"))).toBe(false);
  });
});

describe("score order", () => {
  it("puts the highest score first, then the oldest lead, with no score last", () => {
    const old = new Date("2026-11-01T00:00:00Z");
    const recent = new Date("2026-11-02T00:00:00Z");
    const items = [
      { id: "low", score: 40, createdAt: old },
      { id: "none", score: null, createdAt: old },
      { id: "high-new", score: 90, createdAt: recent },
      { id: "high-old", score: 90, createdAt: old },
    ];
    expect(items.toSorted(compareByScore).map((item) => item.id)).toEqual([
      "high-old",
      "high-new",
      "low",
      "none",
    ]);
  });
});
