import { describe, expect, it } from "vitest";
import {
  agendaCounts,
  agendaDayLabel,
  agendaDetail,
  agendaTiles,
  agendaWhen,
  closedAfterMeetingLabel,
  dueToday,
  groupAgenda,
  OVERDUE_DAY,
  weekEnd,
  type AgendaEntry,
} from "./agenda";

// Tuesday.
const today = "2026-11-03";

const entry = (overrides: Partial<AgendaEntry>): AgendaEntry => ({
  id: crypto.randomUUID(),
  kind: "meeting",
  leadId: "l",
  leadName: "Clínica Sorriso",
  day: today,
  time: "10:00",
  meetingKind: "video",
  ownerName: "Haniel",
  note: "",
  ...overrides,
});

describe("groupAgenda", () => {
  it("groups by day from the earliest, follow-ups first, then meetings by time", () => {
    const days = groupAgenda(
      [
        entry({ id: "late", time: "16:00" }),
        entry({ id: "thu", day: "2026-11-05", time: "09:00" }),
        entry({ id: "early", time: "08:30" }),
        entry({ id: "back", kind: "followup", time: null, meetingKind: null }),
        entry({ id: "wed", day: "2026-11-04", kind: "followup", time: null, meetingKind: null }),
      ],
      today,
    );
    expect(days.map((day) => day.label)).toEqual(["Hoje", "Amanhã", "Quinta-feira, 05/11"]);
    expect(days[0]?.entries.map((item) => item.id)).toEqual(["back", "early", "late"]);
    expect(days[2]?.entries.map((item) => item.id)).toEqual(["thu"]);
  });

  it("puts overdue follow-ups first, in one Atrasados group, oldest first", () => {
    const followup = { kind: "followup" as const, time: null, meetingKind: null };
    const entries = [
      entry({ id: "today" }),
      entry({ ...followup, id: "fri", day: "2026-10-30" }),
      entry({ ...followup, id: "mon", day: "2026-11-02" }),
      entry({ id: "thu", day: "2026-11-05" }),
    ];
    const days = groupAgenda(entries, today);
    expect(days.map((day) => [day.day, day.label])).toEqual([
      [OVERDUE_DAY, "Atrasados"],
      [today, "Hoje"],
      ["2026-11-05", "Quinta-feira, 05/11"],
    ]);
    expect(days[0]?.entries.map((item) => item.id)).toEqual(["fri", "mon"]);
    expect(dueToday(entries, today).map((item) => item.id)).toEqual(["fri", "mon", "today"]);
    expect(agendaCounts(entries, today)).toEqual({ today: 3, week: 4 });
    expect(agendaWhen(entry({ ...followup, day: "2026-10-30" }), today)).toBe("30/10");
    expect(agendaWhen(entry({ ...followup }), today)).toBe("dia todo");
    expect(agendaWhen(entry({}), today)).toBe("10:00");
  });

  it("leaves days without entries out and returns nothing for no entries", () => {
    expect(groupAgenda([], today)).toEqual([]);
  });
});

describe("labels", () => {
  it("names days relative to today", () => {
    expect(agendaDayLabel(today, today)).toBe("Hoje");
    expect(agendaDayLabel("2026-11-04", today)).toBe("Amanhã");
    expect(agendaDayLabel("2026-11-08", today)).toBe("Domingo, 08/11");
  });

  it("describes a row by kind, owner and note", () => {
    expect(agendaDetail(entry({ note: "Levar exemplos" }))).toBe(
      "Videochamada · Haniel · Levar exemplos",
    );
    expect(agendaDetail(entry({ kind: "followup", meetingKind: null, ownerName: null }))).toBe(
      "Retornar o contato",
    );
  });

  it("shows the closing share, or a dash without meetings", () => {
    expect(closedAfterMeetingLabel(2, 5)).toBe("40%");
    expect(closedAfterMeetingLabel(0, 0)).toBe("—");
  });
});

describe("counts and tiles", () => {
  it("counts today and the rest of the week until Sunday", () => {
    expect(weekEnd(today)).toBe("2026-11-08");
    expect(weekEnd("2026-11-08")).toBe("2026-11-08");
    const entries = [entry({}), entry({ day: "2026-11-08" }), entry({ day: "2026-11-09" })];
    expect(agendaCounts(entries, today)).toEqual({ today: 1, week: 2 });
  });

  it("builds the four tiles", () => {
    const tiles = agendaTiles(
      [entry({})],
      {
        proposalsToPresent: 2,
        leadsWithMeeting: 0,
        closedAfterMeeting: 0,
      },
      today,
    );
    expect(tiles.map((tile) => [tile.label, tile.value])).toEqual([
      ["Hoje", "1"],
      ["Esta semana", "1"],
      ["Propostas a apresentar", "2"],
      ["Fecharam após reunião", "—"],
    ]);
  });
});
