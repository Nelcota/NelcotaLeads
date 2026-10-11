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
