import { describe, expect, it } from "vitest";
import {
  AGENDA_MAX_DAYS,
  agendaDayLabel,
  agendaDetail,
  agendaWhen,
  groupAgenda,
  OVERDUE_DAY,
  agendaRangeSchema,
  todaysAgenda,
  todaysAgendaCount,
  type AgendaEntry,
} from "./agenda";
import { addDays } from "./format";

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
  ownerId: "u1",
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
    expect(agendaWhen(entry({ ...followup, day: "2026-10-30" }), today)).toBe("30/10");
    expect(agendaWhen(entry({ ...followup }), today)).toBe("dia todo");
    expect(agendaWhen(entry({}), today)).toBe("10:00");
  });

  it("leaves days without entries out and returns nothing for no entries", () => {
    expect(groupAgenda([], today)).toEqual([]);
  });
});

describe("todaysAgenda", () => {
  const followup = { kind: "followup" as const, time: null, meetingKind: null };

  it("splits the overdue rows (oldest first) from today's (by time) and drops later days", () => {
    const groups = todaysAgenda(
      [
        entry({ id: "late", time: "16:00" }),
        entry({ ...followup, id: "mon", day: "2026-11-02" }),
        entry({ id: "early", time: "08:30" }),
        entry({ ...followup, id: "fri", day: "2026-10-30" }),
        entry({ id: "thu", day: "2026-11-05" }),
      ],
      today,
    );
    expect(groups.overdue.map((item) => item.id)).toEqual(["fri", "mon"]);
    expect(groups.today.map((item) => item.id)).toEqual(["early", "late"]);
  });

  it("counts both groups and leaves out a part that is zero", () => {
    const overdue = [entry({ ...followup, day: "2026-11-02" })];
    const due = [entry({}), entry({ time: "11:00" })];
    expect(todaysAgendaCount({ overdue, today: due })).toBe("2 hoje · 1 atrasado");
    expect(todaysAgendaCount({ overdue: [...overdue, ...overdue, ...overdue], today: [] })).toBe(
      "3 atrasados",
    );
    expect(todaysAgendaCount({ overdue: [], today: [entry({})] })).toBe("1 hoje");
    expect(todaysAgendaCount(todaysAgenda([], today))).toBe("");
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
});

describe("agendaRangeSchema", () => {
  const range = (from: string, to: string) =>
    agendaRangeSchema.safeParse({ owner: null, from, to }).success;

  it("accepts one day and the 42 days of the Month grid", () => {
    expect(range(today, today)).toBe(true);
    expect(range(today, addDays(today, AGENDA_MAX_DAYS - 1))).toBe(true);
  });

  it("refuses a range that ends before it starts or is longer than 42 days", () => {
    expect(range(today, addDays(today, -1))).toBe(false);
    expect(range(today, addDays(today, AGENDA_MAX_DAYS))).toBe(false);
  });
});
