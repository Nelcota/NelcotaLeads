import {
  byTime,
  clock,
  countLabel,
  gridHours,
  minutesOf,
  type CalendarEntry,
} from "@/lib/calendar";
import { dayMonth, weekdayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EntryIcon } from "./entry-icon";
import { TimeColumn, type GridHandlers } from "./time-column";

/** One column of the grid: a day of the Week, or one partner on the Day. */
export type GridColumn = {
  key: string;
  day: string;
  ownerId: string | null;
  /** Week: "Qui" and "5". Day: the partner's initial and name. */
  label: string;
  number: string;
  name: string | null;
  entries: CalendarEntry[];
  onOpen: (() => void) | null;
};

const GUTTER = 56;

/** The Week and Day grid: the headers, the follow-ups row, the hours and one column each. */
export function TimeGrid({
  columns,
  view,
  hourHeight,
  today,
  now,
  handlers,
}: {
  columns: readonly GridColumn[];
  view: "semana" | "dia";
  hourHeight: number;
  today: string;
  now: string;
  handlers: GridHandlers;
}) {
  const all = columns.flatMap((column) => column.entries);
  const { first, last } = gridHours(all);
  const template = `${GUTTER}px repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`;
  const showHeader = columns.length > 1 || view === "semana";
  return (
    <>
      {showHeader ? (
        <div
          className="sticky top-0 z-[7] grid border-b border-border bg-card"
          style={{ gridTemplateColumns: template }}
        >
          <div />
          {columns.map((column) => (
            <ColumnHeader key={column.key} column={column} today={today} view={view} />
          ))}
        </div>
      ) : null}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
        <div className="pt-2.5 pr-2 text-right text-[12px] font-medium text-tertiary">Retornos</div>
        {columns.map((column) => (
          <FollowUps key={column.key} column={column} onPick={handlers.onPick} />
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: template }}>
        <HourLabels first={first} last={last} hourHeight={hourHeight} />
        {columns.map((column) => (
          <TimeColumn
            key={column.key}
            day={column.day}
            ownerId={column.ownerId}
            meetings={column.entries.filter((entry) => entry.minutes !== null)}
            firstHour={first}
            lastHour={last}
            hourHeight={hourHeight}
            grouped={view === "semana"}
            wide={view === "dia"}
            tint={columnTint(view, column.day, today)}
            today={today}
            nowMinutes={minutesOf(now)}
            handlers={handlers}
          />
        ))}
      </div>
    </>
  );
}

function columnTint(view: "semana" | "dia", day: string, today: string): string {
  if (view !== "semana") return "";
  if (day === today) return "bg-primary/[0.07]";
  return day < today ? "bg-fill-3" : "";
}

function ColumnHeader({
  column,
  today,
  view,
}: {
  column: GridColumn;
  today: string;
  view: "semana" | "dia";
}) {
  const isToday = view === "semana" && column.day === today;
  const meetings = column.entries.filter((entry) => entry.minutes !== null).length;
  const followUps = column.entries.length - meetings;
  const content = (
    <>
      {column.label ? <span>{column.label}</span> : null}
      <span
        className={cn(
          "inline-grid h-[30px] min-w-[30px] place-items-center rounded-full px-1.5 font-semibold",
          isToday ? "bg-primary text-primary-foreground" : "",
          column.name ? "bg-fill-2 text-[14px] text-muted-foreground" : "text-base text-foreground",
        )}
      >
        {column.number}
      </span>
      {column.name ? (
        <span className="grid min-w-0 text-left leading-[18px]">
          <span className="truncate text-sm font-semibold text-foreground">{column.name}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {countLabel(meetings, followUps)}
          </span>
        </span>
      ) : null}
    </>
  );
  const className =
    "flex h-[52px] min-w-0 items-center justify-center gap-2 border-l border-border text-[14px] font-medium text-muted-foreground";
  if (!column.onOpen) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      onClick={column.onOpen}
      aria-label={
        column.name
          ? `Ver só ${column.name}`
          : `Abrir ${weekdayName(column.day)}, ${dayMonth(column.day)}`
      }
      className={cn(className, "transition-colors hover:bg-fill-2")}
    >
      {content}
    </button>
  );
}

function FollowUps({
  column,
  onPick,
}: {
  column: GridColumn;
  onPick: (entry: CalendarEntry) => void;
}) {
  const followUps = column.entries.filter((entry) => entry.minutes === null).toSorted(byTime);
  return (
    <div className="flex min-h-[38px] min-w-0 flex-col gap-1 border-l border-border p-1.5">
      {followUps.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onPick(entry)}
          title={`Retornar o contato${entry.ownerName ? ` · ${entry.ownerName}` : ""}${entry.overdueFrom ? ` · atrasado desde ${dayMonth(entry.overdueFrom)}` : ""}`}
          className="flex min-h-[26px] min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-left text-xs font-medium transition-colors hover:bg-card-2"
        >
          <EntryIcon kind={null} className="size-3" />
          <span className="min-w-0 truncate">{entry.leadName}</span>
          {entry.overdueFrom ? (
            <span className="shrink-0 text-muted-foreground">{dayMonth(entry.overdueFrom)}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function HourLabels({
  first,
  last,
  hourHeight,
}: {
  first: number;
  last: number;
  hourHeight: number;
}) {
  return (
    <div className="relative" style={{ height: (last - first) * hourHeight }}>
      {Array.from({ length: last - first }, (_, index) => (
        <span
          key={index}
          className="absolute right-2 text-[12px] leading-[14px] font-medium text-tertiary tabular-nums"
          style={{ top: index === 0 ? 4 : index * hourHeight - 7 }}
        >
          {clock((first + index) * 60)}
        </span>
      ))}
    </div>
  );
}
