import { describe, expect, it } from "vitest";
import { activityDay, activityLine, activityTime, type ActivityEvent } from "./team-activity";
import { dealsDelta, meetingWhen, orderMembers, todayLines, todaySummary } from "./team-member";

const now = new Date("2026-11-08T18:00:00-03:00");
const names = new Map([
  ["u1", "Haniel"],
  ["u2", "Phellipe"],
]);

function event(change: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: "e",
    kind: "owner",
    fromValue: null,
    toValue: null,
    userId: "u2",
    leadId: "l",
    leadName: "Clínica Lumière",
    createdAt: new Date("2026-11-08T17:00:00-03:00"),
    ...change,
  };
}

/** A partner with nothing but today's follow-ups and waiting conversations. */
function withToday(due: number, late: number, waiting: number) {
  return {
    id: "u1",
    name: "Haniel",
    held: 0,
    talking: 0,
    meetings: 0,
    proposals: 0,
    won: { deals: 0, revenueCents: 0 },
    previousDeals: 0,
    today: { due, late, waiting, nextMeeting: null },
  };
}

describe("team activity", () => {
  it("says who took, handed out or freed a lead", () => {
    expect(activityLine(event({ toValue: "u2" }), names, "u1", now)).toMatchObject({
      who: "Phellipe",
      verb: "pegou",
      extra: null,
    });
    expect(activityLine(event({ toValue: "u2", userId: "u1" }), names, "u1", now)).toMatchObject({
      who: "Você",
      verb: "entregou",
      extra: "para Phellipe",
    });
    expect(activityLine(event({ toValue: null }), names, "u1", now).verb).toBe("liberou");
  });

  it("names deals, losses, meetings and proposals", () => {
    expect(activityLine(event({ kind: "won", toValue: "240000" }), names, null, now)).toMatchObject(
      {
        verb: "fechou",
        extra: "R$ 2.400",
      },
    );
    expect(activityLine(event({ kind: "lost", toValue: "price" }), names, null, now).verb).toBe(
      "encerrou sem negócio",
    );
    expect(
      activityLine(event({ kind: "meeting", toValue: "cancelled" }), names, null, now).verb,
    ).toBe("cancelou a reunião com");
    expect(
      activityLine(event({ kind: "proposal", toValue: "310000" }), names, null, now),
    ).toMatchObject({
      verb: "montou proposta para",
      extra: "R$ 3.100",
    });
  });

  it("groups by Brazil day and shows recent times relatively", () => {
    expect(activityDay(new Date("2026-11-08T08:00:00-03:00"), now)).toBe("Hoje");
    expect(activityDay(new Date("2026-11-07T23:30:00-03:00"), now)).toBe("Ontem");
    expect(activityDay(new Date("2026-11-06T10:00:00-03:00"), now)).toBe("06/11");
    expect(activityTime(new Date("2026-11-08T17:35:00-03:00"), now)).toBe("há 25 min");
    expect(activityTime(new Date("2026-11-08T15:00:00-03:00"), now)).toBe("há 3 h");
    expect(activityTime(new Date("2026-11-08T09:10:00-03:00"), now)).toBe("09:10");
  });
});

describe("partner column texts", () => {
  it("compares deals with the period before", () => {
    expect(dealsDelta(2, 1, "month", "2026-11-08")).toEqual({ text: "+1 vs outubro", tone: "up" });
    expect(dealsDelta(0, 1, "7d", "2026-11-08")).toEqual({
      text: "−1 vs semana anterior",
      tone: "down",
    });
    expect(dealsDelta(2, 1, "30d", "2026-11-08").text).toBe("+1 vs 30 dias antes");
    expect(dealsDelta(1, 1, "30d", "2026-11-08").text).toBe("Igual aos 30 dias antes");
    expect(dealsDelta(1, 1, "7d", "2026-11-08").text).toBe("Igual à semana anterior");
    expect(dealsDelta(1, 1, "month", "2026-11-08").text).toBe("Igual a outubro");
  });

  it("sums up today in one line for the phone, the overdue part marked", () => {
    expect(todaySummary(withToday(3, 1, 2), true)).toEqual([
      { text: "3 retornos", late: false },
      { text: "1 atrasado", late: true },
      { text: "2 precisam de você", late: false },
    ]);
    expect(todaySummary(withToday(0, 0, 0), true)).toEqual([
      { text: "Nada pendente hoje", late: false },
    ]);
  });

  it("says another partner's conversations await an answer, not that they need you", () => {
    expect(todaySummary(withToday(0, 0, 1), false)).toEqual([
      { text: "1 aguarda resposta", late: false },
    ]);
    expect(todaySummary(withToday(0, 0, 2), false)).toEqual([
      { text: "2 aguardam resposta", late: false },
    ]);
    const waiting = todayLines(withToday(0, 0, 2), "2026-11-08", false);
    expect(waiting.map((line) => line.text)).toEqual(["2 aguardam resposta"]);
    const mine = todayLines(withToday(0, 0, 1), "2026-11-08", true);
    expect(mine.map((line) => line.text)).toEqual(["1 precisa de você"]);
  });

  it("lists only what is pending today, or one quiet line", () => {
    const busy = todayLines(withToday(3, 1, 0), "2026-11-08", true);
    expect(busy.map((line) => line.kind)).toEqual(["due", "late"]);
    expect(busy.every((line) => line.link !== null)).toBe(true);
    const quiet = todayLines(withToday(0, 0, 0), "2026-11-08", true);
    expect(quiet).toEqual([{ kind: "none", text: "Nada pendente hoje", link: null, label: "" }]);
  });

  it("puts you first, then everyone by name", () => {
    const team = [
      { id: "u1", name: "Haniel" },
      { id: "u3", name: "Guilherme" },
      { id: "u2", name: "Phellipe" },
    ];
    expect(orderMembers(team, "u2").map((member) => member.name)).toEqual([
      "Phellipe",
      "Guilherme",
      "Haniel",
    ]);
    expect(orderMembers(team, null).map((member) => member.name)).toEqual([
      "Guilherme",
      "Haniel",
      "Phellipe",
    ]);
  });

  it("names the next meeting's day", () => {
    expect(meetingWhen(new Date("2026-11-08T16:00:00-03:00"), "2026-11-08")).toBe("Hoje, 16:00");
    expect(meetingWhen(new Date("2026-11-09T10:00:00-03:00"), "2026-11-08")).toBe("Amanhã, 10:00");
    expect(meetingWhen(new Date("2026-11-12T09:30:00-03:00"), "2026-11-08")).toBe("12/11, 09:30");
  });
});
