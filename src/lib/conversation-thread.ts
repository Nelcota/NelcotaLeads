import { dayDiff, dayMonth, localDay, weekdayName } from "@/lib/format";

/** A thread longer than this opens showing only its newest messages. */
export const COLLAPSE_AFTER = 4;

/** How many of the newest messages a collapsed thread shows. */
export const KEEP_WHEN_COLLAPSED = 3;

type Dated = { sentAt: Date | null; sendAfter: Date | null; createdAt: Date };

export type DayBreak<T> = { message: T; dayBreak: string | null };

/** When a message belongs in the thread: when it went out, when it will, or when it was written. */
export function messageInstant(message: Dated): Date {
  return message.sentAt ?? message.sendAfter ?? message.createdAt;
}

/** "Hoje", "Ontem" or "Qui, 05/11" for a YYYY-MM-DD day. */
export function dayLabel(day: string, today: string): string {
  const diff = dayDiff(day, today);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return `${weekdayName(day).slice(0, 3)}, ${dayMonth(day)}`;
}

/** The messages a thread shows: all of them, or only the newest while a long thread is collapsed. */
export function shownMessages<T>(messages: readonly T[], expanded: boolean): readonly T[] {
  if (expanded) return messages;
  if (messages.length <= COLLAPSE_AFTER) return messages;
  return messages.slice(-KEEP_WHEN_COLLAPSED);
}

/** Each message with the day label drawn above it; null when it shares the day of the one before. */
export function withDayBreaks<T extends Dated>(
  messages: readonly T[],
  today: string,
): DayBreak<T>[] {
  return messages.map((message, index) => {
    const day = localDay(messageInstant(message));
    const previous = messages[index - 1];
    const sameDay = previous !== undefined && localDay(messageInstant(previous)) === day;
    return { message, dayBreak: sameDay ? null : dayLabel(day, today) };
  });
}
