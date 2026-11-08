import { Button } from "@/components/ui/button";
import { byTime, clock, countLabel, duration, minutesOf, type CalendarEntry } from "@/lib/calendar";

/**
 * The Day's top line ("Hoje" when it is; the day itself is in the toolbar): how much it has and a
 * shortcut to the next meeting (the first one on a day ahead).
 */
export function DaySummary({
  day,
  today,
  now,
  entries,
  onPick,
}: {
  day: string;
  today: string;
  now: string;
  entries: readonly CalendarEntry[];
  onPick: (entry: CalendarEntry) => void;
}) {
  const ofDay = entries.filter((entry) => entry.day === day);
  const meetings = ofDay.filter((entry) => entry.minutes !== null).toSorted(byTime);
  const isToday = day === today;
  const next = nextMeeting(meetings, day, today, now);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-4 py-3">
      {isToday ? (
        <span className="inline-flex h-[22px] items-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
          Hoje
        </span>
      ) : null}
      <span className="text-[14px] font-medium text-muted-foreground">
        {countLabel(meetings.length, ofDay.length - meetings.length)}
      </span>
      {next ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPick(next)}
          className="ml-auto max-w-full"
        >
          <span className="font-semibold text-primary">{isToday ? "Próxima" : "Primeira"}</span>
          <span className="font-semibold tabular-nums">
            {clock(next.minutes ?? 0)}
            {isToday ? ` (em ${duration((next.minutes ?? 0) - minutesOf(now))})` : ""}
          </span>
          <span className="truncate text-muted-foreground">{next.leadName}</span>
        </Button>
      ) : null}
    </div>
  );
}

/** Today: the next meeting after now. A day ahead: its first meeting. A past day: none. */
function nextMeeting(
  meetings: readonly CalendarEntry[],
  day: string,
  today: string,
  now: string,
): CalendarEntry | undefined {
  if (day === today) return meetings.find((entry) => (entry.minutes ?? 0) > minutesOf(now));
  if (day > today) return meetings[0];
  return undefined;
}
