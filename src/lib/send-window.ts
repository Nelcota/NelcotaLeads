import { addDays, brazilInstant, localDay } from "./format";

/** Brazil hours (UTC-3, no daylight saving time) in which first e-mails and follow-ups go out. */
export type SendWindow = { start: number; end: number };

/** What decides whether the day's run may send: the window and the pause switch. */
export type DispatchControl = SendWindow & { pausedAt: Date | null };

const BRAZIL_OFFSET_HOURS = 3;

/** The hour (0 to 23) of an instant in Brazil time. */
export function brazilHour(now: Date): number {
  return (now.getUTCHours() - BRAZIL_OFFSET_HOURS + 24) % 24;
}

/** True from `start`:00 until just before `end`:00, Brazil time. */
export function isInsideSendWindow(now: Date, start: number, end: number): boolean {
  const hour = brazilHour(now);
  return hour >= start && hour < end;
}

function hourText(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** `start`:00 in Brazil time on the given YYYY-MM-DD day. */
export function windowStartOn(day: string, start: number): Date {
  return brazilInstant(day, hourText(start));
}

/** The next `start`:00 in Brazil time after `now` (today's when it is still ahead, else tomorrow's). */
export function nextWindowStart(now: Date, start: number): Date {
  const today = localDay(now);
  const todays = windowStartOn(today, start);
  if (now.getTime() < todays.getTime()) return todays;
  return windowStartOn(addDays(today, 1), start);
}

/** `at` itself when it falls inside the window, else the start of the next window. */
export function windowSlot(at: Date, window: SendWindow): Date {
  if (isInsideSendWindow(at, window.start, window.end)) return at;
  return nextWindowStart(at, window.start);
}

/**
 * `count` send times starting at `from`, `gapMs` apart, each one inside the window: a slot that
 * would fall after the window closes moves to the next day's opening.
 */
export function sendSlots(from: Date, count: number, gapMs: number, window: SendWindow): Date[] {
  const slots: Date[] = [];
  let next = from;
  for (let index = 0; index < count; index += 1) {
    const slot = windowSlot(next, window);
    slots.push(slot);
    next = new Date(slot.getTime() + gapMs);
  }
  return slots;
}

/** Whether first e-mails and follow-ups may go out now: inside the window and not paused. */
export function coldSendingOpen(control: DispatchControl, now: Date): boolean {
  if (control.pausedAt) return false;
  return isInsideSendWindow(now, control.start, control.end);
}

export type ScoredItem = { id: string; score: number | null; createdAt: Date };

/** Highest score first (no score last), then the oldest lead, then the id, so ties are stable. */
export function compareByScore(a: ScoredItem, b: ScoredItem): number {
  const scoreA = a.score ?? -Infinity;
  const scoreB = b.score ?? -Infinity;
  if (scoreA !== scoreB) return scoreB - scoreA;
  const age = a.createdAt.getTime() - b.createdAt.getTime();
  if (age !== 0) return age;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
