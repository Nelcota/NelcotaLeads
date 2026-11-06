import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  firstOfMonth,
  monthGrid,
  monthIndex,
  MONTHS,
  shiftMonth,
  WEEKDAY_INITIALS,
} from "@/lib/calendar";
import { dayMonth, isoWeekday, weekdayName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MonthChooser } from "./month-chooser";

type Range = { from: string; to: string };

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A small month calendar: pick a day, or open the month and year view (a strip of years and the
 * twelve months). Today is a filled blue circle; the selected day has a gray ring.
 */
export function DatePanel({
  selected,
  today,
  highlight = null,
  busyDays,
  minDay,
  startWithMonths = false,
  onPick,
  onPickMonth,
}: {
  selected: string;
  today: string;
  highlight?: Range | null;
  busyDays: ReadonlySet<string>;
  /** Days before it cannot be picked (a new meeting cannot be in the past). */
  minDay?: string;
  startWithMonths?: boolean;
  onPick: (day: string) => void;
  /** Picking a month calls this instead of showing its days (the Month view). */
  onPickMonth?: (firstDay: string) => void;
}) {
  const [month, setMonth] = useState(firstOfMonth(selected));
  const [mode, setMode] = useState<"days" | "months">(startWithMonths ? "months" : "days");

  if (mode === "months") {
    return (
      <MonthChooser
        month={month}
        today={today}
        onBack={() => setMode("days")}
        onYear={(year) => setMonth(`${year}${month.slice(4)}`)}
        onMonth={(first) => {
          if (onPickMonth) return onPickMonth(first);
          setMonth(first);
          setMode("days");
        }}
      />
    );
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode("months")}
          aria-label="Escolher mês e ano"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors hover:bg-fill-2"
        >
          {capitalize(MONTHS[monthIndex(month)] ?? "")} de {month.slice(0, 4)}
          <ChevronDownIcon aria-hidden className="size-3.5 text-muted-foreground" />
        </button>
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mês anterior"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Próximo mês"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span
            key={index}
            aria-hidden
            className="grid h-6 place-items-center text-[11px] font-medium text-tertiary"
          >
            {initial}
          </span>
        ))}
        {monthGrid(month).map((day) => (
          <DayButton
            key={day}
            day={day}
            inMonth={monthIndex(day) === monthIndex(month)}
            today={today}
            selected={day === selected}
            highlight={highlight}
            busy={busyDays.has(day)}
            disabled={minDay !== undefined && day < minDay}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

function DayButton({
  day,
  inMonth,
  today,
  selected,
  highlight,
  busy,
  disabled,
  onPick,
}: {
  day: string;
  inMonth: boolean;
  today: string;
  selected: boolean;
  highlight: Range | null;
  busy: boolean;
  disabled: boolean;
  onPick: (day: string) => void;
}) {
  const inRange = highlight !== null && day >= highlight.from && day <= highlight.to;
  const isToday = day === today;
  return (
    <button
      type="button"
      aria-label={`${weekdayName(day)}, ${dayMonth(day)}${isToday ? " (hoje)" : ""}`}
      aria-pressed={selected || inRange}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onPick(day);
      }}
      className={cn(
        "group relative grid h-10 place-items-center text-[13px] font-medium",
        inRange ? "bg-fill-2" : "",
        inRange && (day === highlight?.from || isoWeekday(day) === 1) ? "rounded-l-full" : "",
        inRange && (day === highlight?.to || isoWeekday(day) === 7) ? "rounded-r-full" : "",
        inMonth ? "text-foreground" : "text-tertiary",
        disabled ? "cursor-default text-tertiary line-through decoration-border" : "",
      )}
    >
      <span
        className={cn(
          "grid size-[30px] place-items-center rounded-full transition-[background-color,box-shadow] duration-150",
          !disabled && !isToday
            ? "group-hover:bg-fill group-hover:ring-1 group-hover:ring-border"
            : "",
          selected && !isToday ? "bg-fill ring-[1.5px] ring-border" : "",
          isToday ? "bg-primary font-bold text-primary-foreground" : "",
        )}
      >
        {Number(day.slice(8, 10))}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full",
          busy && !disabled ? "bg-tertiary" : "bg-transparent",
        )}
      />
    </button>
  );
}
