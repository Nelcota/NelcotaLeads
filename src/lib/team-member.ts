import { addDays, localDay, localTime } from "./format";
import { monthName } from "./goal";
import { PREVIOUS_CAPTIONS, type OverviewPeriod } from "./period";
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

/** What the comparison is against: "outubro", or "os 7 dias anteriores". */
function previousName(period: OverviewPeriod, today: string): string {
  if (period !== "month") return PREVIOUS_CAPTIONS[period];
  return monthName(addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7));
}

/** "+1 vs outubro", "−1 vs os 7 dias anteriores" or "Igual a outubro". */
export function dealsDelta(
  deals: number,
  previous: number,
  period: OverviewPeriod,
  today: string,
): { text: string; tone: DeltaTone } {
  const name = previousName(period, today);
  const diff = deals - previous;
  // "a" + "os" contracts: "Igual aos 7 dias anteriores".
  if (diff === 0) return { text: `Igual ${period === "month" ? "a " : "a"}${name}`, tone: "flat" };
  const sign = diff > 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(diff)} vs ${name}`, tone: diff > 0 ? "up" : "down" };
}

/** "Hoje, 16:00", "Amanhã, 10:00" or "12/11, 09:30", with the lead's name. */
export function meetingWhen(startsAt: Date, today: string): string {
  const day = localDay(startsAt);
  const time = localTime(startsAt);
  if (day === today) return `Hoje, ${time}`;
  if (day === addDays(today, 1)) return `Amanhã, ${time}`;
  return `${day.slice(8, 10)}/${day.slice(5, 7)}, ${time}`;
}

export type TodayKind = "due" | "late" | "waiting" | "meeting";

/** One line of "Hoje": a link when there is something to open, plain grey text otherwise. */
export type TodayLine = {
  kind: TodayKind;
  text: string;
  link: TeamLink | null;
  label: string;
};

/** "Hoje" in one line for the phone: "3 retornos · 1 atrasado · 2 precisam de você". */
export function todaySummary(member: MemberFigures): { text: string; late: boolean }[] {
  const { due, late, waiting } = member.today;
  const parts = [
    due > 0 ? { text: plural(due, "retorno", "retornos"), late: false } : null,
    late > 0 ? { text: plural(late, "atrasado", "atrasados"), late: true } : null,
    waiting > 0
      ? { text: plural(waiting, "precisa de você", "precisam de você"), late: false }
      : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts : [{ text: "Nada para hoje", late: false }];
}

/** The four lines of "Hoje", always in the same order so the columns line up. */
export function todayLines(member: MemberFigures, today: string): TodayLine[] {
  const { due, late, waiting, nextMeeting } = member.today;
  const name = member.name;
  return [
    due > 0
      ? {
          kind: "due",
          text: plural(due, "retorno para hoje", "retornos para hoje"),
          link: teamLinks.followUps(member.id),
          label: `Abrir em Leads os retornos de ${name}`,
        }
      : { kind: "due", text: "Nenhum retorno hoje", link: null, label: "" },
    late > 0
      ? {
          kind: "late",
          text: plural(late, "retorno atrasado", "retornos atrasados"),
          link: teamLinks.followUps(member.id),
          label: `Abrir em Leads os retornos atrasados de ${name}`,
        }
      : { kind: "late", text: "Nenhum retorno atrasado", link: null, label: "" },
    waiting > 0
      ? {
          kind: "waiting",
          text: plural(waiting, "precisa de você", "precisam de você"),
          link: teamLinks.waiting(member.id),
          label: `Abrir em Conversas as conversas de ${name} que precisam da equipe`,
        }
      : { kind: "waiting", text: "Nenhuma conversa precisa de você", link: null, label: "" },
    nextMeeting
      ? {
          kind: "meeting",
          text: `${meetingWhen(nextMeeting.startsAt, today)} · ${nextMeeting.leadName}`,
          link: teamLinks.meetingDay(member.id, nextMeeting.startsAt),
          label: `Abrir o dia na Agenda de ${name}`,
        }
      : { kind: "meeting", text: "Sem reunião marcada", link: null, label: "" },
  ];
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
