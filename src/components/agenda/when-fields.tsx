import { CalendarIcon, ChevronsUpDownIcon } from "@/components/icons";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clock, halfHours, longDay } from "@/lib/calendar";
import { DatePanel } from "./date-panel";

/** The times a meeting can start at, every half hour from 07:00 to 21:30. */
const TIMES = halfHours(7, 22).map(clock);

/** "Dia": the day in full in a pill that opens the calendar; past days cannot be picked. */
export function DayField({
  value,
  today,
  busyDays,
  onChange,
}: {
  value: string;
  today: string;
  busyDays: ReadonlySet<string>;
  onChange: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="meeting-day">Dia</Label>
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id="meeting-day"
            className="flex h-10 w-full items-center gap-2 rounded-full border border-border pr-2.5 pl-3.5 text-left text-base font-medium transition-colors hover:bg-fill-2 aria-expanded:bg-fill-2"
          >
            <CalendarIcon aria-hidden className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">
              {longDay(value)} de {value.slice(0, 4)}
            </span>
            <ChevronsUpDownIcon aria-hidden className="size-3 text-tertiary" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[60] w-(--radix-popover-trigger-width) min-w-[296px] border border-border p-3 shadow-none"
        >
          <DatePanel
            selected={value}
            today={today}
            busyDays={busyDays}
            minDay={today}
            onPick={(day) => {
              onChange(day);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** "Horário": every half hour in the app's Select. */
export function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const options = TIMES.includes(value) ? TIMES : [...TIMES, value].toSorted();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="meeting-time">Horário</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="meeting-time" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[60] max-h-64 shadow-none">
          {options.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
