import { PlusIcon } from "lucide-react";
import {
  byTime,
  clock,
  monthGrid,
  monthIndex,
  WEEKDAY_SHORT,
  type CalendarEntry,
} from "@/lib/calendar";
import { dayMonth, weekdayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EntryIcon } from "./entry-icon";

/** A day cell lists its meetings before its follow-ups, so "+N mais" hides the follow-ups. */
function meetingsFirst(a: CalendarEntry, b: CalendarEntry): number {
  return Number(a.minutes === null) - Number(b.minutes === null) || byTime(a, b);
}

/** How many entries a day cell lists before "+N mais". */
const VISIBLE_PER_DAY = 3;

/**
 * The Month: six weeks of days, up to three entries each. The day's number opens it on the Day
 * view; the empty area of a day from today on opens "Nova reunião" on it.
 */
export function MonthGrid({
  anchor,
  today,
  entries,
  onOpenDay,
  onBookDay,
  onPick,
}: {
  anchor: string;
  today: string;
  entries: readonly CalendarEntry[];
  onOpenDay: (day: string) => void;
  onBookDay: (day: string) => void;
  onPick: (entry: CalendarEntry) => void;
}) {
  const month = monthIndex(anchor);
  return (
    <>
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="-mt-px -ml-px grid grid-cols-7">
        {monthGrid(anchor).map((day) => (
          <DayCell
            key={day}
            day={day}
            inMonth={monthIndex(day) === month}
            today={today}
            entries={entries.filter((entry) => entry.day === day).toSorted(meetingsFirst)}
            onOpenDay={onOpenDay}
            onBookDay={onBookDay}
            onPick={onPick}
          />
        ))}
      </div>
    </>
  );
}

function DayCell({
  day,
  inMonth,
  today,
  entries,
  onOpenDay,
  onBookDay,
  onPick,
}: {
  day: string;
  inMonth: boolean;
  today: string;
  entries: CalendarEntry[];
  onOpenDay: (day: string) => void;
  onBookDay: (day: string) => void;
  onPick: (entry: CalendarEntry) => void;
}) {
  const canBook = day >= today;
  const label = `${weekdayName(day)}, ${dayMonth(day)}`;
  const hidden = entries.length - VISIBLE_PER_DAY;
  return (
    <div
      className={cn(
        "group relative flex min-h-[118px] min-w-0 flex-col gap-[3px] border-t border-l border-border p-1.5",
        inMonth ? "" : "bg-fill-3",
        canBook ? "transition-colors hover:bg-fill-3" : "",
      )}
    >
      {canBook ? (
        <>
          <button
            type="button"
            onClick={() => onBookDay(day)}
            aria-label={`Marcar reunião em ${label}`}
            title={`Marcar reunião em ${label}`}
            className="absolute inset-0 z-0 cursor-pointer"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-2 right-2 z-[1] grid size-6 scale-90 place-items-center rounded-full bg-fill-2 text-muted-foreground opacity-0 transition-[opacity,transform] duration-150 group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100"
          >
            <PlusIcon className="size-3.5" />
          </span>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => onOpenDay(day)}
        aria-label={`Abrir ${label}`}
        className={cn(
          "relative z-[1] inline-grid h-7 min-w-7 place-items-center self-start rounded-full px-1.5 text-[14px] font-semibold transition-colors",
          day === today ? "bg-primary text-primary-foreground" : "hover:bg-fill",
          day !== today && !inMonth ? "text-tertiary" : "",
        )}
      >
        {Number(day.slice(8, 10))}
      </button>
      {entries.slice(0, VISIBLE_PER_DAY).map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onPick(entry)}
          title={entry.minutes === null ? `Retornar o contato · ${entry.leadName}` : entry.leadName}
          className="relative z-[1] flex min-h-[22px] min-w-0 items-center gap-[5px] rounded-md bg-fill-2 px-1.5 text-left text-[13px] font-medium transition-colors hover:bg-fill"
        >
          <EntryIcon kind={entry.meetingKind} className="size-3" />
          {entry.minutes === null ? null : (
            <span className="shrink-0 font-semibold text-muted-foreground tabular-nums">
              {clock(entry.minutes)}
            </span>
          )}
          <span className="min-w-0 truncate">{entry.leadName}</span>
        </button>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => onOpenDay(day)}
          className="relative z-[1] self-start px-1.5 py-0.5 text-xs font-semibold text-primary"
        >
          +{hidden} mais
        </button>
      ) : null}
    </div>
  );
}
