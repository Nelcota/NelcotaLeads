import { addDays, localDay, localTime } from "./format";
import { monthName } from "./goal";
import type { OverviewPeriod } from "./period";
import { teamLinks, type TeamLink } from "./team-links";

/** One partner as the Equipe page receives it. */
export type MemberFigures = {
  id: string;
  name: string;
  held: number;
  talking: number;
  meetings: number;
  proposals: number;
  won: { deals: number; revenueCents: number };
  previousDeals: number;
  today: {
    due: number;
    late: number;
    waiting: number;
    nextMeeting: { leadId: string; leadName: string; startsAt: Date } | null;
  };
};

export type DeltaTone = "up" | "down" | "flat";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "fechamento" or "fechamentos", after the big number. */
export function dealsWord(count: number): string {
  return count === 1 ? "fechamento" : "fechamentos";
}

/** The short names of the period before, as the column says them (approved canvas, 2026-11-12). */
const PREVIOUS_SHORT: Record<Exclude<OverviewPeriod, "month">, { vs: string; same: string }> = {
  "7d": { vs: "semana anterior", same: "Igual à semana anterior" },
  "30d": { vs: "30 dias antes", same: "Igual aos 30 dias antes" },
};

/** What the comparison is against: "outubro", or "semana anterior" / "30 dias antes". */
function previousCaption(period: OverviewPeriod, today: string): { vs: string; same: string } {
  if (period !== "month") return PREVIOUS_SHORT[period];
  const month = monthName(addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7));
  return { vs: month, same: `Igual a ${month}` };
}

/** "+1 vs outubro", "−1 vs semana anterior" or "Igual aos 30 dias antes", on one line. */
export function dealsDelta(
  deals: number,
  previous: number,
  period: OverviewPeriod,
  today: string,
): { text: string; tone: DeltaTone } {
  const caption = previousCaption(period, today);
  const diff = deals - previous;
  if (diff === 0) return { text: caption.same, tone: "flat" };
  const sign = diff > 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(diff)} vs ${caption.vs}`, tone: diff > 0 ? "up" : "down" };
}

/** Conversations waiting: "precisa de você" on your own line, "aguarda resposta" on the others'. */
function waitingText(waiting: number, isMe: boolean): string {
  if (isMe) return plural(waiting, "precisa de você", "precisam de você");
  return plural(waiting, "aguarda resposta", "aguardam resposta");
}

/** Said once when a partner has nothing for today. */
export const NOTHING_TODAY = "Nada pendente hoje";

/** "Hoje, 16:00", "Amanhã, 10:00" or "12/11, 09:30", with the lead's name. */
export function meetingWhen(startsAt: Date, today: string): string {
  const day = localDay(startsAt);
  const time = localTime(startsAt);
  if (day === today) return `Hoje, ${time}`;
  if (day === addDays(today, 1)) return `Amanhã, ${time}`;
  return `${day.slice(8, 10)}/${day.slice(5, 7)}, ${time}`;
}

/** "none" is the single quiet line when a partner has nothing for today. */
export type TodayKind = "due" | "late" | "waiting" | "meeting" | "none";

/** One line of "Hoje": a link when there is something to open, plain grey text otherwise. */
export type TodayLine = {
  kind: TodayKind;
  text: string;
  link: TeamLink | null;
  label: string;
};

/** "Hoje" in one line for the phone: "3 retornos · 1 atrasado · 2 aguardam resposta". */
export function todaySummary(
  member: MemberFigures,
  isMe: boolean,
): { text: string; late: boolean }[] {
  const { due, late, waiting } = member.today;
  const parts = [
    due > 0 ? { text: plural(due, "retorno", "retornos"), late: false } : null,
    late > 0 ? { text: plural(late, "atrasado", "atrasados"), late: true } : null,
    waiting > 0 ? { text: waitingText(waiting, isMe), late: false } : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts : [{ text: NOTHING_TODAY, late: false }];
}

/**
 * "Hoje": only what has something to open, always in the same order (due, overdue, waiting,
 * next meeting); one plain "Nada pendente hoje" line when there is nothing (approved canvas,
 * 2026-11-12: four "Nenhum…" lines per partner said too much).
 */
export function todayLines(member: MemberFigures, today: string, isMe: boolean): TodayLine[] {
  const { due, late, waiting, nextMeeting } = member.today;
  const name = member.name;
  const lines: (TodayLine | null)[] = [
    due > 0
      ? {
          kind: "due",
          text: plural(due, "retorno para hoje", "retornos para hoje"),
          link: teamLinks.followUps(member.id),
          label: `Abrir em Leads os retornos de ${name}`,
        }
      : null,
    late > 0
      ? {
          kind: "late",
          text: plural(late, "retorno atrasado", "retornos atrasados"),
          link: teamLinks.followUps(member.id),
          label: `Abrir em Leads os retornos atrasados de ${name}`,
        }
      : null,
    waiting > 0
      ? {
          kind: "waiting",
          text: waitingText(waiting, isMe),
          link: teamLinks.waiting(member.id),
          label: `Abrir em Conversas as conversas de ${name} que aguardam resposta`,
        }
      : null,
    nextMeeting
      ? {
          kind: "meeting",
          text: `${meetingWhen(nextMeeting.startsAt, today)} · ${nextMeeting.leadName}`,
          link: teamLinks.meetingDay(member.id, nextMeeting.startsAt),
          label: `Abrir o dia na Agenda de ${name}`,
        }
      : null,
  ];
  const busy = lines.filter((line) => line !== null);
  if (busy.length > 0) return busy;
  return [{ kind: "none", text: NOTHING_TODAY, link: null, label: "" }];
}

/** "Você" first, then everyone else by name (decided 2026-11-09: no ranking among partners). */
export function orderMembers<T extends { id: string; name: string }>(
  members: readonly T[],
  me: string | null,
): T[] {
  return members.toSorted((a, b) => {
    if (a.id === me) return -1;
    if (b.id === me) return 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
