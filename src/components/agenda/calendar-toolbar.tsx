import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AgendaCalendar } from "@/hooks/use-agenda-calendar";
import { calendarRange, CALENDAR_VIEWS, rangeLabel, VIEW_LABELS, zoomLabel } from "@/lib/calendar";
import { DatePanel } from "./date-panel";

const STEP_LABELS = {
  mes: ["Mês anterior", "Próximo mês"],
  semana: ["Semana anterior", "Próxima semana"],
  dia: ["Dia anterior", "Próximo dia"],
} as const;

/**
 * The bar above the calendar, the same in every view: Hoje, back and forward, the period (which
 * opens a date picker), the zoom of the Week and Day, and Mês | Semana | Dia.
 */
export function CalendarToolbar({
  calendar,
  busyDays,
  isMobile,
}: {
  calendar: AgendaCalendar;
  busyDays: ReadonlySet<string>;
  isMobile: boolean;
}) {
  const { view } = calendar;
  const [prevLabel, nextLabel] = STEP_LABELS[view];
  return (
    <div
      role="toolbar"
      aria-label="Navegar na agenda"
      className="flex flex-wrap items-center gap-x-2.5 gap-y-2"
    >
      <Button variant="outline" size="sm" onClick={calendar.goToday}>
        Hoje
      </Button>
      <span className="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={prevLabel}
          onClick={() => calendar.step(-1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={nextLabel}
          onClick={() => calendar.step(1)}
        >
          <ChevronRightIcon />
        </Button>
      </span>
      <PeriodPicker calendar={calendar} busyDays={busyDays} />
      {view !== "mes" ? <ZoomControl calendar={calendar} /> : null}
      {isMobile ? null : <ViewSwitch calendar={calendar} />}
    </div>
  );
}

function PeriodPicker({
  calendar,
  busyDays,
}: {
  calendar: AgendaCalendar;
  busyDays: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const { view, anchor } = calendar;
  const pick = (day: string) => {
    calendar.pickDay(day);
    setOpen(false);
  };
  return (
    <h2 className="min-w-0 flex-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Escolher a data"
            className="relative -ml-1 inline-flex h-9 max-w-full items-center gap-2 pointer-coarse:touch-target rounded-[10px] px-2.5 transition-colors hover:bg-fill-2 aria-expanded:bg-fill-2"
          >
            <span aria-live="polite" className="truncate text-lg font-semibold tracking-[-0.01em]">
              {rangeLabel(view, anchor)}
            </span>
            <ChevronDownIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[296px] border border-border p-3 shadow-none">
          <DatePanel
            selected={anchor}
            today={calendar.today}
            highlight={view === "semana" ? calendarRange(view, anchor) : null}
            busyDays={busyDays}
            startWithMonths={view === "mes"}
            onPick={pick}
            onPickMonth={view === "mes" ? pick : undefined}
          />
        </PopoverContent>
      </Popover>
    </h2>
  );
}

function ZoomControl({ calendar }: { calendar: AgendaCalendar }) {
  return (
    <div
      role="group"
      aria-label="Zoom da agenda"
      className="inline-flex items-center gap-0.5 rounded-full bg-fill-2 p-[3px]"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Afastar"
        title="Afastar"
        disabled={!calendar.canZoomOut}
        onClick={calendar.zoomOut}
      >
        <ZoomOutIcon />
      </Button>
      <span
        title="Altura de cada hora"
        className="min-w-10 text-center text-xs font-semibold text-muted-foreground tabular-nums"
      >
        {zoomLabel(calendar.zoom)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Aproximar"
        title="Aproximar"
        disabled={!calendar.canZoomIn}
        onClick={calendar.zoomIn}
      >
        <ZoomInIcon />
      </Button>
    </div>
  );
}

function ViewSwitch({ calendar }: { calendar: AgendaCalendar }) {
  return (
    <div role="group" aria-label="Visão" className="inline-flex gap-1.5">
      {CALENDAR_VIEWS.map((option) => {
        const active = option === calendar.view;
        return (
          <ChoicePill
            key={option}
            size="sm"
            aria-pressed={active}
            selected={active}
            onClick={() => calendar.goTo(option, calendar.anchor)}
          >
            {VIEW_LABELS[option]}
          </ChoicePill>
        );
      })}
    </div>
  );
}
