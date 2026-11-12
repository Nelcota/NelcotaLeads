import { weekDays, WEEKDAY_SHORT } from "@/lib/calendar";
import { dayMonth, weekdayName } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The phone's week strip above the Day: one button per day, a dot on days with something. */
export function DayStrip({
  anchor,
  today,
  busyDays,
  onPick,
}: {
  anchor: string;
  today: string;
  busyDays: ReadonlySet<string>;
  onPick: (day: string) => void;
}) {
  return (
    <div role="group" aria-label="Dias da semana" className="grid grid-cols-7 gap-1">
      {weekDays(anchor).map((day, index) => {
        const selected = day === anchor;
        return (
          <button
            key={day}
            type="button"
            aria-pressed={selected}
            aria-label={`${weekdayName(day)}, ${dayMonth(day)}`}
            onClick={() => onPick(day)}
            className={cn(
              "flex min-h-[52px] flex-col items-center gap-0.5 rounded-[14px] py-1.5 transition-colors",
              selected ? "bg-primary text-primary-foreground" : "hover:bg-fill-2",
              !selected && day === today ? "text-primary" : "",
            )}
          >
            <span className="text-2xs font-medium">{WEEKDAY_SHORT[index]}</span>
            <span className="text-lg font-semibold">{Number(day.slice(8, 10))}</span>
            <span
              aria-hidden
              className={cn(
                "size-1 rounded-full",
                busyDays.has(day) ? (selected ? "bg-primary-foreground" : "bg-tertiary") : "",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
