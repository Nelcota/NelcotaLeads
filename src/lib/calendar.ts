import { z } from "zod";
import type { AgendaEntry } from "./agenda";
import { addDays, dayDiff, isoWeekday, weekdayName } from "./format";

/** The Agenda's views; it opens on Week. */
export const CALENDAR_VIEWS = ["mes", "semana", "dia"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];
export const calendarViewSchema = z.enum(CALENDAR_VIEWS);

export const VIEW_LABELS: Record<CalendarView, string> = {
  mes: "Mês",
  semana: "Semana",
  dia: "Dia",
};

/** Every meeting takes 30 minutes on the grid while meetings have no end time. */
export const MEETING_MINUTES = 30;

/** The grid's hours when nothing falls outside them. */
const FIRST_HOUR = 7;
const LAST_HOUR = 19;

/** Pixels per hour of each zoom step; 56 is 100%. */
export const ZOOM_LEVELS = [36, 44, 56, 72, 96] as const;
export const DEFAULT_ZOOM = 2;
const BASE_HOUR_HEIGHT = 56;

export const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Monday first, as on the grid's header. */
export const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
export const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "14:30" → 870. */
export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** 870 → "14:30". */
export function clock(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 0-based month of a YYYY-MM-DD day. */
export function monthIndex(day: string): number {
  return Number(day.slice(5, 7)) - 1;
}

export function mondayOf(day: string): string {
  return addDays(day, 1 - isoWeekday(day));
}

export function firstOfMonth(day: string): string {
  return `${day.slice(0, 8)}01`;
}

/** The first day of the month `months` away. */
export function shiftMonth(day: string, months: number): string {
  const date = new Date(`${firstOfMonth(day)}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

/** The 7 days of the day's week, Monday first. */
export function weekDays(day: string): string[] {
  const monday = mondayOf(day);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** The 42 days (6 weeks) that show the day's month, Monday first. */
export function monthGrid(day: string): string[] {
  const start = mondayOf(firstOfMonth(day));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

/** The days a view shows around its anchor day. */
export function calendarRange(view: CalendarView, anchor: string) {
  if (view === "dia") return { from: anchor, to: anchor };
  const days = view === "semana" ? weekDays(anchor) : monthGrid(anchor);
  return { from: days[0] ?? anchor, to: days.at(-1) ?? anchor };
}

/**
 * The days the Agenda loads. A phone always shows the Day, but its strip marks every busy day of
 * the week, so it loads the whole week around the day.
 */
export function loadedRange(view: CalendarView, anchor: string, isMobile: boolean) {
  return calendarRange(isMobile ? "semana" : view, anchor);
}

/** The anchor one step back (-1) or ahead (1): a month, a week or a day. */
export function stepAnchor(view: CalendarView, anchor: string, direction: -1 | 1): string {
  if (view === "mes") return shiftMonth(anchor, direction);
  return addDays(anchor, view === "semana" ? 7 * direction : direction);
}

/** "2 – 8 de novembro de 2026", "Quinta-feira, 5 de novembro" or "Novembro de 2026". */
export function rangeLabel(view: CalendarView, anchor: string): string {
  const year = anchor.slice(0, 4);
  if (view === "mes") return `${capitalize(MONTHS[monthIndex(anchor)] ?? "")} de ${year}`;
  if (view === "dia") return longDay(anchor);
  const days = weekDays(anchor);
  const first = days[0] ?? anchor;
  const last = days.at(-1) ?? anchor;
  const end = `${Number(last.slice(8, 10))} de ${MONTHS[monthIndex(last)]} de ${last.slice(0, 4)}`;
  if (monthIndex(first) === monthIndex(last)) return `${Number(first.slice(8, 10))} – ${end}`;
  return `${Number(first.slice(8, 10))} de ${MONTHS[monthIndex(first)]} – ${end}`;
}

/** "Quinta-feira, 5 de novembro". */
export function longDay(day: string): string {
  return `${weekdayName(day)}, ${Number(day.slice(8, 10))} de ${MONTHS[monthIndex(day)]}`;
}

export function hourHeight(zoom: number): number {
  return ZOOM_LEVELS[zoom] ?? BASE_HOUR_HEIGHT;
}

/** "64%", "100%" or "171%" of the default zoom. */
export function zoomLabel(zoom: number): string {
  return `${Math.round((hourHeight(zoom) / BASE_HOUR_HEIGHT) * 100)}%`;
}

/** A row on the calendar: the entry, its minutes and, for an overdue follow-up, its old day. */
export type CalendarEntry = AgendaEntry & { minutes: number | null; overdueFrom: string | null };

/**
 * The entries placed on the calendar. A follow-up whose day passed is still to do (like Leads →
 * "Retornar hoje"), so it shows on today, marked with the day it was due.
 */
export function calendarEntries(entries: readonly AgendaEntry[], today: string): CalendarEntry[] {
  return entries.map((entry) => {
    const overdue = entry.kind === "followup" && entry.day < today;
    return {
      ...entry,
      day: overdue ? today : entry.day,
      minutes: entry.time ? minutesOf(entry.time) : null,
      overdueFrom: overdue ? entry.day : null,
    };
  });
}

/** Follow-ups first, then meetings by time, then by lead. */
export function byTime(a: CalendarEntry, b: CalendarEntry): number {
  return (a.minutes ?? -1) - (b.minutes ?? -1) || a.leadName.localeCompare(b.leadName, "pt-BR");
}

/** The grid's first and last hour: 7h to 19h, widened to fit a meeting outside them. */
export function gridHours(entries: readonly CalendarEntry[]) {
  const minutes = entries.flatMap((entry) => (entry.minutes === null ? [] : [entry.minutes]));
  const earliest = Math.min(FIRST_HOUR, ...minutes.map((value) => Math.floor(value / 60)));
  const latest = Math.max(
    LAST_HOUR,
    ...minutes.map((value) => Math.ceil((value + MEETING_MINUTES) / 60)),
  );
  return { first: earliest, last: Math.min(latest, 24) };
}

/** Every half hour from the first hour to the last. */
export function halfHours(first: number, last: number): number[] {
  return Array.from({ length: (last - first) * 2 }, (_, index) => first * 60 + index * 30);
}

/** A meeting placed in a column: its lane and how many lanes its overlap uses. */
export type Placed = { entry: CalendarEntry; lane: number; lanes: number };

/** Lanes for overlapping meetings, so two at the same time sit side by side. */
export function layoutLanes(meetings: readonly CalendarEntry[]): Placed[] {
  const sorted = meetings.filter((entry) => entry.minutes !== null).toSorted(byTime);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    const lanes = Math.max(1, ...cluster.map((item) => item.lane + 1));
    for (const item of cluster) item.lanes = lanes;
    cluster = [];
  };
  for (const entry of sorted) {
    const start = entry.minutes ?? 0;
    if (start >= clusterEnd) {
      closeCluster();
      laneEnds = [];
    }
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = start + MEETING_MINUTES;
    const item = { entry, lane, lanes: 1 };
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, start + MEETING_MINUTES);
  }
  closeCluster();
  return placed;
}

/** Meetings that start at the same minute, for the Week's grouped card. */
export function sameTimeGroups(meetings: readonly CalendarEntry[]) {
  const byMinute = new Map<number, CalendarEntry[]>();
  for (const entry of meetings) {
    if (entry.minutes === null) continue;
    byMinute.set(entry.minutes, [...(byMinute.get(entry.minutes) ?? []), entry]);
  }
  const groups = [...byMinute.values()].filter((list) => list.length > 1);
  const singles = [...byMinute.values()].filter((list) => list.length === 1).flat();
  return { groups, singles };
}

/**
 * The first free half hour for "Marcar reunião" from a day on: from 09:00, or the next half hour
 * after now on today, skipping times already taken. A day with nothing left (late at night)
 * moves to the next day.
 */
export function firstFreeSlot(
  day: string,
  entries: readonly CalendarEntry[],
  today: string,
  now: string,
): { day: string; time: string } {
  const taken = new Set(
    entries.filter((entry) => entry.day === day && entry.minutes !== null).map((e) => e.minutes),
  );
  const earliest = day === today ? Math.ceil((minutesOf(now) + 1) / 30) * 30 : 9 * 60;
  const slot = halfHours(0, 24).find((minutes) => minutes >= earliest && !taken.has(minutes));
  if (slot === undefined) return firstFreeSlot(addDays(day, 1), entries, today, now);
  return { day, time: clock(slot) };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "2 reuniões · 1 retorno", or "Livre". */
export function countLabel(meetings: number, followUps: number): string {
  const parts = [
    meetings > 0 ? plural(meetings, "reunião", "reuniões") : "",
    followUps > 0 ? plural(followUps, "retorno", "retornos") : "",
  ].filter(Boolean);
  return parts.length === 0 ? "Livre" : parts.join(" · ");
}

/** "3 h 20 min", "40 min" or "2 h". */
export function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** When the entry is, said from now: "Hoje, em 3 h 20 min", "Amanhã", "Atrasado há 2 dias". */
export function relativeWhen(entry: CalendarEntry, today: string, now: string) {
  const dueDay = entry.overdueFrom ?? entry.day;
  const days = dayDiff(today, dueDay);
  if (entry.minutes === null) return followUpWhen(days);
  const diff = days * 1440 + entry.minutes - minutesOf(now);
  if (diff <= 0 && diff > -MEETING_MINUTES) return { text: "Acontecendo agora", today: true };
  if (days === 0 && diff > 0) return { text: `Hoje, em ${duration(diff)}`, today: true };
  if (days === 0) {
    return { text: `Hoje, terminou há ${duration(-diff - MEETING_MINUTES)}`, today: false };
  }
  if (days === 1) return { text: "Amanhã", today: false };
  if (days > 1) return { text: `Em ${days} dias`, today: false };
  return { text: days === -1 ? "Ontem" : `Há ${-days} dias`, today: false };
}

function followUpWhen(days: number) {
  if (days === 0) return { text: "Retornar hoje", today: true };
  if (days < 0) {
    return { text: `Atrasado há ${plural(-days, "dia", "dias")}`, today: false };
  }
  return { text: days === 1 ? "Retornar amanhã" : `Retornar em ${days} dias`, today: false };
}

/** A column of the time grid before it gets its click handler. */
export type ColumnSpec = {
  key: string;
  day: string;
  ownerId: string | null;
  label: string;
  number: string;
  name: string | null;
  entries: CalendarEntry[];
};

type Member = { id: string; name: string };

/**
 * The grid's columns: the 7 days of the Week, or on the Day one column per partner (only the
 * filtered one, or a single column on a phone). Entries without an owner get their own column.
 */
export function gridColumns(
  view: "semana" | "dia",
  anchor: string,
  entries: readonly CalendarEntry[],
  team: readonly Member[],
  options: { owner: string | null; single: boolean },
): ColumnSpec[] {
  if (view === "semana") {
    return weekDays(anchor).map((day, index) => ({
      key: day,
      day,
      ownerId: null,
      label: WEEKDAY_SHORT[index] ?? "",
      number: String(Number(day.slice(8, 10))),
      name: null,
      entries: entries.filter((entry) => entry.day === day),
    }));
  }
  const ofDay = entries.filter((entry) => entry.day === anchor);
  if (options.single) {
    return [
      {
        key: anchor,
        day: anchor,
        ownerId: options.owner,
        label: "",
        number: "",
        name: null,
        entries: ofDay,
      },
    ];
  }
  const people = options.owner ? team.filter((member) => member.id === options.owner) : team;
  const columns: ColumnSpec[] = people.map((member) => ({
    key: member.id,
    day: anchor,
    ownerId: member.id,
    label: "",
    number: member.name.charAt(0).toUpperCase(),
    name: member.name,
    entries: ofDay.filter((entry) => entry.ownerId === member.id),
  }));
  const known = new Set(people.map((member) => member.id));
  const orphans = ofDay.filter((entry) => !entry.ownerId || !known.has(entry.ownerId));
  if (options.owner || orphans.length === 0) return columns;
  return [
    ...columns,
    {
      key: "none",
      day: anchor,
      ownerId: null,
      label: "",
      number: "–",
      name: "Sem responsável",
      entries: orphans,
    },
  ];
}
