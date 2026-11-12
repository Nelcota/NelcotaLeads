import { describe, expect, it } from "vitest";
import {
  buildAlerts,
  dispatchRunState,
  nextSendTime,
  replyHourChart,
  type AlertSource,
} from "./overview";

const base = {
  configured: true,
  paused: false,
  queued: 3,
  sentToday: 5,
  limit: 30,
  coldLimit: 24,
  windowStart: 6,
  windowEnd: 18,
};
// 12:00Z is 09:00 in Brazil; 23:00Z is 20:00.
const MORNING = new Date("2026-11-03T12:00:00Z");
const EVENING = new Date("2026-11-03T23:00:00Z");
// 06:00 in Brazil, today and tomorrow.
const TODAY_OPENING = new Date("2026-11-03T09:00:00Z");
const TOMORROW_OPENING = new Date("2026-11-04T09:00:00Z");

describe("dispatchRunState", () => {
  it("runs inside the window with e-mails queued", () => {
    expect(dispatchRunState(base, MORNING)).toEqual({ label: "Rodando", variant: "green" });
    expect(dispatchRunState({ ...base, queued: 0 }, MORNING).label).toBe("Parado");
  });

  it("says when it opens again outside the window", () => {
    expect(dispatchRunState(base, EVENING).label).toBe("Fora do horário · volta às 6h");
  });

  it("shows the pause and a missing mailbox first", () => {
    expect(dispatchRunState({ ...base, paused: true }, EVENING).label).toBe("Pausado");
    expect(dispatchRunState({ ...base, configured: false, paused: true }, MORNING).label).toBe(
      "Caixa não conectada",
    );
  });

  it("says the daily limit is used up", () => {
    expect(dispatchRunState({ ...base, sentToday: 30 }, MORNING)).toEqual({
      label: "Limite do dia atingido",
      variant: "orange",
    });
  });
});

describe("nextSendTime", () => {
  const mail = { ...base, nextSendAt: MORNING };

  it("is the queued slot when it is ahead and inside the window", () => {
    const later = new Date(MORNING.getTime() + 30 * 60_000);
    expect(nextSendTime({ ...mail, nextSendAt: later }, MORNING)).toEqual(later);
  });

  it("never shows a past slot", () => {
    const past = new Date(MORNING.getTime() - 3 * 60 * 60_000);
    expect(nextSendTime({ ...mail, nextSendAt: past }, MORNING)).toEqual(MORNING);
  });

  it("moves to the next opening outside the window", () => {
    expect(nextSendTime(mail, EVENING)).toEqual(TOMORROW_OPENING);
    // 05:00 in Brazil: today's opening is still ahead.
    const early = new Date("2026-11-03T08:00:00Z");
    expect(nextSendTime({ ...mail, nextSendAt: early }, early)).toEqual(TODAY_OPENING);
  });

  it("waits for tomorrow's opening once the limit is used up", () => {
    expect(nextSendTime({ ...mail, sentToday: 30 }, MORNING)).toEqual(TOMORROW_OPENING);
  });

  it("is null with nothing queued", () => {
    expect(nextSendTime({ ...mail, nextSendAt: null }, MORNING)).toBeNull();
  });
});

describe("replyHourChart", () => {
  const rows = [
    { hour: 9, value: 4 },
    { hour: 12, value: 2 },
    { hour: 20, value: 2 },
  ];

  it("shows the configured window and counts the rest as outside it", () => {
    const chart = replyHourChart(rows, { start: 8, end: 12 });
    expect(chart.bars.map((bar) => bar.hour)).toEqual([8, 9, 10, 11, 12]);
    expect(chart.peak).toBe(9);
    // 12h and 20h are outside 8:00–11:59: 4 of 8 replies.
    expect(chart.outsidePercent).toBe(50);
    expect(chart.outside).toBe(4);
  });

  it("never reads 100% outside while one reply came inside the window", () => {
    const chart = replyHourChart(
      [
        { hour: 9, value: 1 },
        { hour: 20, value: 300 },
      ],
      { start: 8, end: 12 },
    );
    expect(chart.outside).toBe(300);
    expect(chart.outsidePercent).toBe(99);
  });
});

function alertSource(offer: boolean, cooling = 0): AlertSource {
  return { today: "2026-11-03", setup: { offer }, stats: { cooling }, activity: { searches: [] } };
}

describe("buildAlerts", () => {
  it("asks for the offer until it is written, before anything else", () => {
    const alerts = buildAlerts(alertSource(false, 2), 0);
    expect(alerts[0]).toMatchObject({
      key: "setup:offer",
      kind: "offer",
      label: "Descrever a oferta",
      link: { to: "/settings", hash: "oferta" },
    });
    expect(alerts).toHaveLength(2);
  });

  it("labels the pending items with their count", () => {
    const alerts = buildAlerts(alertSource(true, 1), 3);
    expect(alerts.map((alert) => alert.label)).toEqual([
      "1 sem resposta há mais de 1 dia",
      "3 retornos para hoje ou atrasados",
    ]);
  });

  it("uses the singular for a single follow-up", () => {
    expect(buildAlerts(alertSource(true), 1)[0]?.label).toBe("1 retorno para hoje ou atrasado");
  });

  it("has no setup alert once the offer exists", () => {
    expect(buildAlerts(alertSource(true), 0)).toEqual([]);
  });
});

describe("cold limit", () => {
  // MAIL_DAILY_LIMIT 30 keeps 6 for replies: first e-mails stop at 24.
  it("stops the dispatch at the cold share of the limit, before the full limit", () => {
    expect(dispatchRunState({ ...base, sentToday: 24 }, MORNING).label).toBe(
      "Limite do dia atingido",
    );
    expect(dispatchRunState({ ...base, sentToday: 23 }, MORNING).label).toBe("Rodando");
  });
});
