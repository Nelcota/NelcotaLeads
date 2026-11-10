import { z } from "zod";
import { addDays, dayDiff, dayMonth, weekdayName } from "./format";
import { daySchema, idSchema, MEETING_KIND_LABELS, type MeetingKind } from "./schemas";

/** Rows of "Agenda de hoje" on the Visão geral. */
export const TODAY_AGENDA_LIMIT = 5;

/** The longest span the Agenda asks for at once: the 6 weeks of the Month grid. */
export const AGENDA_MAX_DAYS = 42;

/** The Agenda's request: everyone or one person of the team, from one day to another. */
export const agendaRangeSchema = z
  .object({ owner: idSchema.nullable(), from: daySchema, to: daySchema })
  .refine(({ from, to }) => from <= to && dayDiff(from, to) < AGENDA_MAX_DAYS, {
    message: "Período inválido",
  });

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
  ownerId: string | null;
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

/** "Agenda de hoje" in two groups: the overdue rows (oldest first), then today's (by time). */
export type TodaysAgenda = { overdue: AgendaEntry[]; today: AgendaEntry[] };

/** What is due today, split so the overdue rows never pass for today's. */
export function todaysAgenda(entries: readonly AgendaEntry[], today: string): TodaysAgenda {
  return {
    overdue: entries.filter((entry) => entry.day < today).toSorted(byDayThenTime),
    today: entries.filter((entry) => entry.day === today).toSorted(byTime),
  };
}

/** "1 hoje · 3 atrasados", leaving out a zero part; "" when nothing is due. */
export function todaysAgendaCount({ overdue, today }: TodaysAgenda): string {
  const todayPart = today.length > 0 ? `${today.length} hoje` : "";
  const overduePart = overdue.length > 0 ? overdueCount(overdue.length) : "";
  return [todayPart, overduePart].filter(Boolean).join(" · ");
}

function overdueCount(count: number): string {
  return count === 1 ? "1 atrasado" : `${count} atrasados`;
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
