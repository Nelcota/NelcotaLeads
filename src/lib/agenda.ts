import { z } from "zod";
import { addDays, dayMonth, isoWeekday, sharePercent, weekdayName } from "./format";
import { idSchema, MEETING_KIND_LABELS, type MeetingKind } from "./schemas";

/** Days the Agenda lists, today included. */
export const AGENDA_DAYS = 14;

/** Rows of "Agenda de hoje" on the Visão geral. */
export const TODAY_AGENDA_LIMIT = 5;

/** The Agenda's filter: everyone, or one person of the team. */
export const agendaFilterSchema = z.object({ owner: idSchema.nullable() });

/**
 * One row of the agenda: a meeting (with its time) or a follow-up day of a lead (no time).
 * `ownerName` is who has the lead; for a meeting on a free lead, who booked it.
 */
export type AgendaEntry = {
  id: string;
  kind: "meeting" | "followup";
  leadId: string;
  leadName: string;
  day: string;
  time: string | null;
  meetingKind: MeetingKind | null;
  ownerName: string | null;
  note: string;
};

export type AgendaDay = { day: string; label: string; entries: AgendaEntry[] };

/** "Hoje", "Amanhã", or "Quinta-feira, 05/11". */
export function agendaDayLabel(day: string, today: string): string {
  if (day === today) return "Hoje";
  if (day === addDays(today, 1)) return "Amanhã";
  return `${weekdayName(day)}, ${dayMonth(day)}`;
}

/** Follow-ups (no time) first, like all-day events, then the meetings by time. */
function byTime(a: AgendaEntry, b: AgendaEntry): number {
  return (a.time ?? "").localeCompare(b.time ?? "") || a.leadName.localeCompare(b.leadName);
}

/** The leading group of follow-ups whose day already passed (a lead still waiting for us). */
export const OVERDUE_DAY = "overdue";

function byDayThenTime(a: AgendaEntry, b: AgendaEntry): number {
  return a.day.localeCompare(b.day) || byTime(a, b);
}

/**
 * The entries in days, from the earliest; days without entries are left out. Follow-ups from
 * before today come first, in one "Atrasados" group (oldest first): they are still to do, like
 * Leads → "Retornar hoje".
 */
export function groupAgenda(entries: readonly AgendaEntry[], today: string): AgendaDay[] {
  const overdue = entries.filter((entry) => entry.day < today).toSorted(byDayThenTime);
  const upcoming = entries.filter((entry) => entry.day >= today);
  const days = [...new Set(upcoming.map((entry) => entry.day))].toSorted();
  const groups = days.map((day) => ({
    day,
    label: agendaDayLabel(day, today),
    entries: upcoming.filter((entry) => entry.day === day).toSorted(byTime),
  }));
  if (overdue.length === 0) return groups;
  return [{ day: OVERDUE_DAY, label: "Atrasados", entries: overdue }, ...groups];
}

/** What is due today: the overdue follow-ups first, then today's rows ("Agenda de hoje"). */
export function dueToday(entries: readonly AgendaEntry[], today: string): AgendaEntry[] {
  return groupAgenda(
    entries.filter((entry) => entry.day <= today),
    today,
  ).flatMap((group) => group.entries);
}

/** The row's "when": the meeting's time, "dia todo" for a follow-up, its day when overdue. */
export function agendaWhen(entry: AgendaEntry, today: string): string {
  if (entry.time) return entry.time;
  return entry.day < today ? dayMonth(entry.day) : "dia todo";
}

/** "Videochamada · Haniel · Levar o orçamento": what is known about the row, in order. */
export function agendaDetail(entry: AgendaEntry): string {
  const what = entry.meetingKind ? MEETING_KIND_LABELS[entry.meetingKind] : "Retornar o contato";
  return [what, entry.ownerName, entry.note].filter(Boolean).join(" · ");
}

/** The last day (Sunday) of today's week. */
export function weekEnd(today: string): string {
  return addDays(today, 7 - isoWeekday(today));
}

/**
 * Rows due today (overdue follow-ups included, as in Leads → "Retornar hoje") and due until
 * Sunday, for the summary tiles and the sidebar badge.
 */
export function agendaCounts(entries: readonly AgendaEntry[], today: string) {
  const end = weekEnd(today);
  return {
    today: entries.filter((entry) => entry.day <= today).length,
    week: entries.filter((entry) => entry.day <= end).length,
  };
}

/** "40%" of the leads with a meeting that closed, or "—" without any meeting yet. */
export function closedAfterMeetingLabel(closed: number, withMeeting: number): string {
  const percent = sharePercent(closed, withMeeting);
  return percent === null ? "—" : `${percent}%`;
}

export type AgendaTile = {
  label: string;
  value: string;
  caption: string;
  tone?: "blue" | "orange";
};

export type AgendaSummary = {
  proposalsToPresent: number;
  leadsWithMeeting: number;
  closedAfterMeeting: number;
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/** Hoje, Esta semana, Propostas a apresentar and Fecharam após reunião. */
export function agendaTiles(
  entries: readonly AgendaEntry[],
  summary: AgendaSummary,
  today: string,
): AgendaTile[] {
  const counts = agendaCounts(entries, today);
  return [
    {
      label: "Hoje",
      value: String(counts.today),
      caption: plural(counts.today, "compromisso", "compromissos"),
      tone: counts.today > 0 ? "blue" : undefined,
    },
    {
      label: "Esta semana",
      value: String(counts.week),
      caption: "até domingo",
    },
    {
      label: "Propostas a apresentar",
      value: String(summary.proposalsToPresent),
      caption: plural(summary.proposalsToPresent, "lead em Proposta", "leads em Proposta"),
      tone: summary.proposalsToPresent > 0 ? "orange" : undefined,
    },
    {
      label: "Fecharam após reunião",
      value: closedAfterMeetingLabel(summary.closedAfterMeeting, summary.leadsWithMeeting),
      caption:
        summary.leadsWithMeeting > 0
          ? `${summary.closedAfterMeeting} de ${summary.leadsWithMeeting} com reunião`
          : "nenhuma reunião ainda",
    },
  ];
}
