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

function dayDiff(from: string, to: string): number {
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
