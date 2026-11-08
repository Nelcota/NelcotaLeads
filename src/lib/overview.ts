import type { Dashboard } from "@/server/dashboard";
import { addDays, localDay } from "./format";
import { isInsideSendWindow, windowSlot, windowStartOn, type SendWindow } from "./send-window";

const HOUR_MS = 60 * 60 * 1000;

/** A conversation waiting longer than this is late: red in "Precisa de você" and an alert on top. */
export const LATE_REPLY_HOURS = 24;

/** Whole hours since `date`, never negative. */
export function hoursSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / HOUR_MS));
}

/** "há 40 min", "há 3 h", "há 2 dias": how long a lead has been waiting. */
export function waitingLabel(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

/** "Dentistas, Belo Horizonte", skipping what is missing. */
export function nicheAndCity(niche: string | null, city: string | null): string {
  return [niche, city].filter((part): part is string => Boolean(part)).join(", ");
}

export type OverviewAlert = {
  key: string;
  tone: "orange" | "red";
  text: string;
  action: string;
  link:
    | { to: "/conversas"; search: { filter: "needsYou" } }
    | { to: "/leads"; search: { view: "followup" } | { view: "all"; searchId: string } }
    | { to: "/settings"; hash: "oferta" };
};

/**
 * What needs a look today: the missing offer (the AI writes generic e-mails without it),
 * interested leads left without an answer for a day (one alert for all of them; each one also
 * shows in red under "Precisa de você"), failed searches and due follow-ups. The mailbox is not
 * an alert: connecting it is not up to the team, and "Disparo de hoje" and the sidebar show it.
 */
/** The parts of the dashboard the alerts read. */
export type AlertSource = {
  today: string;
  setup: Pick<Dashboard["setup"], "offer">;
  stats: Pick<Dashboard["stats"], "cooling">;
  activity: Pick<Dashboard["activity"], "searches">;
};

export function buildAlerts(data: AlertSource, followUps: number): OverviewAlert[] {
  const alerts: OverviewAlert[] = [];
  if (!data.setup.offer) {
    alerts.push({
      key: "setup:offer",
      tone: "orange",
      text: "Conte o que a Nelcota vende: sem isso, a IA escreve e-mails genéricos.",
      action: "Escrever",
      link: { to: "/settings", hash: "oferta" },
    });
  }
  const cooling = data.stats.cooling;
  if (cooling > 0) {
    alerts.push({
      // Keyed by count and day: a new cooling lead brings a dismissed alert back.
      key: `cooling:${data.today}:${cooling}`,
      tone: "orange",
      text:
        cooling === 1
          ? "1 lead interessado está sem resposta há mais de 1 dia."
          : `${cooling} leads interessados estão sem resposta há mais de 1 dia.`,
      action: "Responder",
      link: { to: "/conversas", search: { filter: "needsYou" } },
    });
  }
  for (const search of data.activity.searches) {
    if (search.status !== "error") continue;
    alerts.push({
      key: `search:${search.id}`,
      tone: "red",
      text: `A busca de ${search.niche} em ${search.city} falhou hoje.`,
      action: "Ver busca",
      link: { to: "/leads", search: { view: "all", searchId: search.id } },
    });
  }
  if (followUps > 0) {
    alerts.push({
      key: `followup:${data.today}`,
      tone: "orange",
      text: `${followUps} ${followUps === 1 ? "lead tem" : "leads têm"} retorno marcado para hoje ou atrasado.`,
      action: "Ver leads",
      link: { to: "/leads", search: { view: "followup" } },
    });
  }
  return alerts;
}

export type ReplyHourBar = { hour: number; value: number; share: number; isPeak: boolean };

/**
 * Bars for the configured send window (say 6h to 18h), scaled to the busiest hour, plus the
 * share of replies that came outside it (6:00 to 17:59; the 18h bar is shown but already
 * outside it). The peak is the busiest hour shown.
 */
export function replyHourChart(rows: { hour: number; value: number }[], window: SendWindow) {
  const byHour = new Map(rows.map((row) => [row.hour, row.value]));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const hours = Array.from(
    { length: window.end - window.start + 1 },
    (_, index) => window.start + index,
  );
  const values = hours.map((hour) => byHour.get(hour) ?? 0);
  const max = Math.max(0, ...values);
  const peakHour = max > 0 ? hours[values.indexOf(max)] : undefined;
  const inside = hours.reduce(
    (sum, hour, index) => (hour < window.end ? sum + (values[index] ?? 0) : sum),
    0,
  );
  const bars: ReplyHourBar[] = hours.map((hour, index) => {
    const value = values[index] ?? 0;
    return { hour, value, share: max > 0 ? value / max : 0, isPeak: value > 0 && value === max };
  });
  return {
    bars,
    total,
    peak: peakHour,
    outsidePercent: total > 0 ? Math.round(((total - inside) / total) * 100) : 0,
  };
}

export type DispatchRunState = {
  label: string;
  variant: "green" | "orange" | "gray";
};

type DispatchMail = Pick<
  Dashboard["mail"],
  "configured" | "paused" | "queued" | "sentToday" | "coldLimit" | "windowStart" | "windowEnd"
>;

/**
 * Whether first e-mails stopped for today. The sender keeps part of the daily limit for
 * conversation replies (coldDailyLimit), so the dispatch is done before `limit` is reached.
 */
function limitReached(mail: Pick<Dashboard["mail"], "sentToday" | "coldLimit">): boolean {
  return mail.sentToday >= mail.coldLimit;
}

/**
 * The "Disparo de hoje" badge: no mailbox, paused by the team, the daily limit used up,
 * outside the send window (with the hour it opens again), sending, or nothing left to send.
 */
export function dispatchRunState(mail: DispatchMail, now: Date): DispatchRunState {
  if (!mail.configured) return { label: "Caixa não conectada", variant: "orange" };
  if (mail.paused) return { label: "Pausado", variant: "orange" };
  if (limitReached(mail)) return { label: "Limite do dia atingido", variant: "orange" };
  if (!isInsideSendWindow(now, mail.windowStart, mail.windowEnd)) {
    return { label: `Fora do horário · volta às ${mail.windowStart}h`, variant: "gray" };
  }
  if (mail.queued > 0) return { label: "Rodando", variant: "green" };
  return { label: "Parado", variant: "gray" };
}

/**
 * When the next queued e-mail is expected to go out, never in the past: its slot or now,
 * whichever is later, moved into the send window; tomorrow's opening once the daily limit is
 * used up. Null when nothing is queued.
 */
export function nextSendTime(
  mail: Pick<
    Dashboard["mail"],
    "nextSendAt" | "sentToday" | "coldLimit" | "windowStart" | "windowEnd"
  >,
  now: Date,
): Date | null {
  if (!mail.nextSendAt) return null;
  if (limitReached(mail)) return windowStartOn(addDays(localDay(now), 1), mail.windowStart);
  const due = new Date(Math.max(mail.nextSendAt.getTime(), now.getTime()));
  return windowSlot(due, { start: mail.windowStart, end: mail.windowEnd });
}
