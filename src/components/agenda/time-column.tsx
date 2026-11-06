import { useState, type DragEvent } from "react";
import {
  clock,
  halfHours,
  layoutLanes,
  MEETING_MINUTES,
  sameTimeGroups,
  type CalendarEntry,
} from "@/lib/calendar";
import { dayMonth, weekdayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DRAG_TYPE, EventCard, GroupCard } from "./event-card";

export type GridHandlers = {
  /** A free half hour was clicked: book a meeting there. */
  onSlot: (day: string, time: string, ownerId: string | null) => void;
  onPick: (entry: CalendarEntry) => void;
  onGroup: (entries: readonly CalendarEntry[]) => void;
  /** A meeting was dropped on a half hour: reschedule it there. */
  onDrop: (meetingId: string, day: string, time: string, ownerId: string | null) => void;
};

/** Whether a Brazil day and minute are still ahead of now (a meeting can only go there). */
export function isAhead(day: string, minutes: number, today: string, nowMinutes: number) {
  return day > today || (day === today && minutes > nowMinutes);
}

/**
 * One day (or one partner on the Day view) of the time grid: a button per free half hour, the
 * meetings on top, and drop targets for a dragged meeting.
 */
export function TimeColumn({
  day,
  ownerId,
  meetings,
  firstHour,
  lastHour,
  hourHeight,
  grouped,
  wide,
  tint,
  today,
  nowMinutes,
  handlers,
}: {
  day: string;
  ownerId: string | null;
  meetings: readonly CalendarEntry[];
  firstHour: number;
  lastHour: number;
  hourHeight: number;
  /** The Week groups meetings at the same time into one card. */
  grouped: boolean;
  /** The Day's columns are wide enough to show the note after the lead. */
  wide: boolean;
  tint: string;
  today: string;
  nowMinutes: number;
  handlers: GridHandlers;
}) {
  const [dropAt, setDropAt] = useState<number | null>(null);
  const top = (minutes: number) => ((minutes - firstHour * 60) / 60) * hourHeight;
  const slotHeight = hourHeight / 2;
  const cardHeight = (hourHeight * MEETING_MINUTES) / 60 - 3;
  const compact = hourHeight < 50;
  const { groups, singles } = grouped
    ? sameTimeGroups(meetings)
    : { groups: [], singles: [...meetings] };
  // A group is laid out as one card (its first meeting), so it never covers another meeting.
  const groupOf = new Map(groups.map((list) => [list[0]?.id ?? "", list]));

  const drop = (event: DragEvent, minutes: number) => {
    event.preventDefault();
    setDropAt(null);
    const id = event.dataTransfer.getData(DRAG_TYPE);
    if (id) handlers.onDrop(id, day, clock(minutes), ownerId);
  };

  return (
    <div
      className="@container relative min-w-0 border-l border-border"
      style={{
        height: (lastHour - firstHour) * hourHeight,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${hourHeight}px)`,
      }}
    >
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", tint)} />
      {halfHours(firstHour, lastHour).map((minutes) => {
        const ahead = isAhead(day, minutes, today, nowMinutes);
        return (
          <button
            key={minutes}
            type="button"
            tabIndex={ahead ? 0 : -1}
            aria-label={`Marcar reunião ${weekdayName(day)}, ${dayMonth(day)} às ${clock(minutes)}`}
            disabled={!ahead}
            onClick={() => handlers.onSlot(day, clock(minutes), ownerId)}
            onDragOver={(event) => {
              if (!ahead) return;
              event.preventDefault();
              setDropAt(minutes);
            }}
            onDragLeave={() => setDropAt((current) => (current === minutes ? null : current))}
            onDrop={(event) => drop(event, minutes)}
            className="absolute inset-x-0 cursor-pointer transition-colors hover:bg-fill-3 disabled:cursor-default disabled:hover:bg-transparent"
            style={{ top: top(minutes), height: slotHeight }}
          />
        );
      })}
      {dropAt !== null ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[3px] z-[3] flex items-center rounded-lg border-[1.5px] border-dashed border-primary px-2 text-xs font-semibold text-primary"
          style={{ top: top(dropAt) + 1, height: cardHeight }}
        >
          {clock(dropAt)}
        </div>
      ) : null}
      {layoutLanes([...singles, ...groups.flatMap((list) => list.slice(0, 1))]).map(
        ({ entry, lane, lanes }) => {
          const style = {
            top: top(entry.minutes ?? 0) + 1,
            height: cardHeight,
            left: `calc(${(lane * 100) / lanes}% + 3px)`,
            width: `calc(${100 / lanes}% - 6px)`,
          };
          const group = groupOf.get(entry.id);
          if (group) {
            return (
              <GroupCard
                key={entry.id}
                entries={group}
                compact={compact}
                onPick={handlers.onGroup}
                style={style}
              />
            );
          }
          return (
            <EventCard
              key={entry.id}
              entry={entry}
              compact={compact}
              detail={wide ? entry.note : ""}
              canDrag={isAhead(entry.day, entry.minutes ?? 0, today, nowMinutes)}
              onPick={handlers.onPick}
              style={style}
            />
          );
        },
      )}
    </div>
  );
}
