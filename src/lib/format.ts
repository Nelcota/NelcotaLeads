const TIME_ZONE = "America/Sao_Paulo";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, dateStyle: "short" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});

/** Fixed time zone so server-rendered and hydrated output match (Workers run in UTC). */
export function formatDate(date: Date, withTime = false): string {
  return (withTime ? dateTimeFormat : dateFormat).format(date);
}

/** `yyyy-MM-dd HH:mm` in Brazil time, for exports. */
export function formatIsoLocal(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** `yyyy-MM-dd` of the given instant in Brazil time. */
export function localDay(date: Date): string {
  return formatIsoLocal(date).slice(0, 10);
}

/** Shifts a YYYY-MM-DD day by whole days (calendar math, no time zone involved). */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from one YYYY-MM-DD day to another. */
export function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** "hoje", "amanhã", "há 3 dias", "em 5 dias" or dd/mm for days further away. */
export function relativeDay(day: string, today: string): string {
  const diff = dayDiff(today, day);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 1 && diff <= 7) return `em ${diff} dias`;
  if (diff < -1 && diff >= -7) return `há ${-diff} dias`;
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

/** "14:05" for today, "ontem 14:05", or "09/10 14:05" (Brazil time). */
export function shortTime(date: Date, today = localDay(new Date())): string {
  const iso = formatIsoLocal(date);
  const day = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  if (day === today) return time;
  if (dayDiff(day, today) === 1) return `ontem ${time}`;
  return `${day.slice(8, 10)}/${day.slice(5, 7)} ${time}`;
}

/**
 * A step's share of the one before, in whole percent; null when it is larger (the counts come
 * from different sources, e.g. a lead whose e-mail was removed after it was contacted).
 */
export function sharePercent(value: number, of: number): number | null {
  return of > 0 && value >= 0 && value <= of ? Math.round((value / of) * 100) : null;
}

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

/** "Quinta-feira" for a YYYY-MM-DD day (calendar math, no time zone involved). */
export function weekdayName(day: string): string {
  return WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()] ?? "";
}

/** "05/11" of a YYYY-MM-DD day. */
export function dayMonth(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** "14:05" of an instant, in Brazil time. */
export function localTime(date: Date): string {
  return formatIsoLocal(date).slice(11, 16);
}

/**
 * The instant of a Brazil day and HH:MM time. Brazil has had no daylight saving time since
 * 2019, so it is always UTC-3.
 */
export function brazilInstant(day: string, time: string): Date {
  return new Date(`${day}T${time}:00-03:00`);
}

/** 1 (Monday) to 7 (Sunday) for a YYYY-MM-DD day. */
export function isoWeekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
}

const usd = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** "US$ 0,0012": an AI cost in dollars, with the decimal comma the rest of the app uses. */
export function formatUsd(value: number): string {
  return usd.format(value);
}

const counter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** "1.000" for 1000: a count shown to people, thousands grouped by dots. */
export function formatCount(value: number): string {
  return counter.format(value);
}

/** "1 busca", "1.200 buscas": a count with the word that agrees with it. */
export function pluralize(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}
