import { describe, expect, it } from "vitest";
import type { AgendaEntry } from "./agenda";
import {
  calendarEntries,
  calendarRange,
  countLabel,
  firstFreeSlot,
  gridHours,
  layoutLanes,
  loadedRange,
  monthGrid,
  rangeLabel,
  relativeWhen,
  sameTimeGroups,
  shiftMonth,
  stepAnchor,
  TOUCH_ZOOM,
  ZOOM_LEVELS,
  zoomLabel,
} from "./calendar";

const today = "2026-11-05";

function entry(overrides: Partial<AgendaEntry>): AgendaEntry {
  return {
    id: "m1",
    kind: "meeting",
    leadId: "a",
    leadName: "Clínica A",
    day: today,
    time: "14:00",
    meetingKind: "video",
    ownerId: "u1",
    ownerName: "Haniel",
    note: "",
    ...overrides,
  };
}

describe("calendar ranges", () => {
  it("covers the week from Monday, the day, and the six weeks of the month", () => {
    expect(calendarRange("semana", today)).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(calendarRange("dia", today)).toEqual({ from: today, to: today });
    expect(calendarRange("mes", today)).toEqual({ from: "2026-10-26", to: "2026-12-06" });
    expect(monthGrid(today)).toHaveLength(42);
  });

  it("loads the whole week on a phone, so the week strip can mark its busy days", () => {
    expect(loadedRange("dia", today, true)).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(loadedRange("dia", today, false)).toEqual({ from: today, to: today });
    expect(loadedRange("mes", today, false)).toEqual(calendarRange("mes", today));
  });

  it("steps by month, week or day, and names the range", () => {
    expect(stepAnchor("semana", today, 1)).toBe("2026-11-12");
    expect(stepAnchor("dia", today, -1)).toBe("2026-11-04");
    expect(stepAnchor("mes", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-01");
    expect(rangeLabel("semana", today)).toBe("2 – 8 de novembro de 2026");
    expect(rangeLabel("semana", "2026-10-28")).toBe("26 de outubro – 1 de novembro de 2026");
    expect(rangeLabel("mes", today)).toBe("Novembro de 2026");
    expect(rangeLabel("dia", today)).toBe("Quinta-feira, 5 de novembro");
  });

  it("labels the zoom against 56 px per hour", () => {
    expect(zoomLabel(0)).toBe("64%");
    expect(zoomLabel(2)).toBe("100%");
    expect(zoomLabel(4)).toBe("171%");
  });
});

describe("calendar entries", () => {
  it("moves an overdue follow-up to today and keeps the day it was due", () => {
    const [late] = calendarEntries(
      [entry({ kind: "followup", day: "2026-10-30", time: null, meetingKind: null })],
      today,
    );
    expect(late).toMatchObject({ day: today, overdueFrom: "2026-10-30", minutes: null });
  });

  it("puts meetings that overlap side by side and groups the ones at the same time", () => {
    const entries = calendarEntries(
      [
        entry({ id: "a", time: "14:00" }),
        entry({ id: "b", time: "14:00", leadName: "Clínica B" }),
        entry({ id: "c", time: "16:00" }),
      ],
      today,
    );
    expect(layoutLanes(entries).map((item) => [item.entry.id, item.lane, item.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 1],
    ]);
    const { groups, singles } = sameTimeGroups(entries);
    expect(groups.map((list) => list.map((item) => item.id))).toEqual([["a", "b"]]);
    expect(singles.map((item) => item.id)).toEqual(["c"]);
  });

  it("widens the grid for a meeting outside 7h–19h", () => {
    expect(gridHours([])).toEqual({ first: 7, last: 19 });
    expect(gridHours(calendarEntries([entry({ time: "19:30" })], today))).toEqual({
      first: 7,
      last: 20,
    });
  });

  it("suggests the next free half hour: after now today, from 09:00 on other days", () => {
    const entries = calendarEntries([entry({ time: "11:00" })], today);
    expect(firstFreeSlot(today, entries, today, "10:40")).toEqual({ day: today, time: "11:30" });
    expect(firstFreeSlot("2026-11-27", entries, today, "10:40")).toEqual({
      day: "2026-11-27",
      time: "09:00",
    });
    expect(firstFreeSlot(today, entries, today, "23:45")).toEqual({
      day: "2026-11-06",
      time: "09:00",
    });
  });

  it("says when a meeting or follow-up is, from now", () => {
    const at = (time: string, day = today) =>
      relativeWhen(calendarEntries([entry({ time, day })], today)[0], today, "10:40").text;
    expect(at("14:00")).toBe("Hoje, em 3 h 20 min");
    expect(at("10:30")).toBe("Acontecendo agora");
    expect(at("09:30")).toBe("Hoje, terminou há 40 min");
    expect(at("10:00", "2026-11-06")).toBe("Amanhã");
    expect(at("10:00", "2026-11-03")).toBe("Há 2 dias");
    const late = calendarEntries(
      [entry({ kind: "followup", day: "2026-11-04", time: null, meetingKind: null })],
      today,
    );
    expect(relativeWhen(late[0], today, "10:40").text).toBe("Atrasado há 1 dia");
  });

  it("counts the day as reuniões and retornos", () => {
    expect(countLabel(2, 1)).toBe("2 reuniões · 1 retorno");
    expect(countLabel(0, 0)).toBe("Livre");
  });
});

describe("TOUCH_ZOOM", () => {
  it("opens touch screens on a zoom whose half-hour slot is at least 44px", () => {
    expect((ZOOM_LEVELS[TOUCH_ZOOM] ?? 0) / 2).toBeGreaterThanOrEqual(44);
  });
});
