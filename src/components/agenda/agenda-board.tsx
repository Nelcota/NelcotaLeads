import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgendaActions } from "@/hooks/use-agenda-actions";
import type { AgendaCalendar } from "@/hooks/use-agenda-calendar";
import {
  clock,
  firstFreeSlot,
  gridColumns,
  hourHeight,
  minutesOf,
  type CalendarEntry,
} from "@/lib/calendar";
import { PAST_MEETING_MESSAGE } from "@/lib/meetings";
import { CalendarToolbar } from "./calendar-toolbar";
import { DayStrip } from "./day-strip";
import { DaySummary } from "./day-summary";
import { MeetingDetail } from "./meeting-detail";
import { MeetingDialog, type MeetingTarget } from "./meeting-dialog";
import { MeetingGroup } from "./meeting-group";
import { MonthGrid } from "./month-grid";
import { isAhead, type GridHandlers } from "./time-column";
import { TimeGrid } from "./time-grid";

type Detail = { entry: CalendarEntry; fromGroup: readonly CalendarEntry[] | null };

/**
 * The Agenda's calendar: the toolbar, the Month or the Week/Day grid, and the dialogs to see a
 * meeting, book one and move one. `bookRequest` is the header's "Marcar reunião".
 */
export function AgendaBoard({
  calendar,
  isMobile,
  target,
  onTarget,
}: {
  calendar: AgendaCalendar;
  isMobile: boolean;
  target: MeetingTarget | null;
  onTarget: (target: MeetingTarget | null) => void;
}) {
  const actions = useAgendaActions();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [group, setGroup] = useState<readonly CalendarEntry[] | null>(null);
  const { entries, today, now, anchor } = calendar;
  const busyDays = useMemo(
    () => new Set(entries.filter((entry) => entry.minutes !== null).map((entry) => entry.day)),
    [entries],
  );

  const book = (day: string, time: string, leadId = "") => {
    setDetail(null);
    onTarget({ mode: "book", day, time, leadId });
  };
  const bookDay = (day: string) => {
    const slot = firstFreeSlot(day, entries, today, now);
    book(slot.day, slot.time);
  };

  const handlers: GridHandlers = {
    onSlot: (day, time) => book(day, time),
    onPick: (entry) => setDetail({ entry, fromGroup: null }),
    onGroup: setGroup,
    onDrop: (id, day, time, ownerId) => {
      const entry = entries.find((item) => item.id === id);
      if (!entry || entry.minutes === null) return;
      if (entry.day === day && entry.minutes === minutesOf(time)) return;
      // On the Day each column is a partner; who goes cannot change by dragging (yet).
      if (ownerId && entry.ownerId !== ownerId) {
        toast.error(`Arraste dentro da coluna de ${entry.ownerName ?? "quem vai"}.`);
        return;
      }
      if (!isAhead(day, minutesOf(time), today, minutesOf(now))) {
        toast.error(PAST_MEETING_MESSAGE);
        return;
      }
      actions.reschedule({ id, day, time, from: { day: entry.day, time: clock(entry.minutes) } });
    },
  };

  return (
    <div className="grid gap-4">
      <CalendarToolbar calendar={calendar} busyDays={busyDays} isMobile={isMobile} />
      {isMobile ? (
        <DayStrip anchor={anchor} today={today} busyDays={busyDays} onPick={calendar.pickDay} />
      ) : null}
      <CalendarBody
        calendar={calendar}
        isMobile={isMobile}
        handlers={handlers}
        onBookDay={bookDay}
      />
      {detail ? (
        <MeetingDetail
          entry={detail.entry}
          today={today}
          now={now}
          backLabel={
            detail.fromGroup ? `Voltar às ${detail.fromGroup.length} reuniões` : "Voltar à agenda"
          }
          busy={actions.cancelling}
          onBack={() => {
            setGroup(detail.fromGroup);
            setDetail(null);
          }}
          onClose={() => setDetail(null)}
          onReschedule={(entry) => {
            setDetail(null);
            onTarget({
              mode: "reschedule",
              entry,
              day: entry.day,
              time: clock(entry.minutes ?? 0),
            });
          }}
          onCancel={(entry) => actions.cancel(entry.id, { onSuccess: () => setDetail(null) })}
          onBook={(entry) => {
            const day = entry.day < today ? today : entry.day;
            const slot = firstFreeSlot(day, entries, today, now);
            book(slot.day, slot.time, entry.leadId);
          }}
        />
      ) : null}
      {group ? (
        <MeetingGroup
          entries={group}
          onClose={() => setGroup(null)}
          onPick={(entry) => {
            setDetail({ entry, fromGroup: group });
            setGroup(null);
          }}
        />
      ) : null}
      {target ? (
        <MeetingDialog
          key={
            target.mode === "book" ? `${target.day}${target.time}${target.leadId}` : target.entry.id
          }
          target={target}
          today={today}
          busyDays={busyDays}
          actions={actions}
          onClose={() => onTarget(null)}
        />
      ) : null}
    </div>
  );
}

function CalendarBody({
  calendar,
  isMobile,
  handlers,
  onBookDay,
}: {
  calendar: AgendaCalendar;
  isMobile: boolean;
  handlers: GridHandlers;
  onBookDay: (day: string) => void;
}) {
  const { view, anchor, entries, today, now } = calendar;
  if (calendar.failed) {
    return (
      <p className="text-sm text-red">Não foi possível carregar a agenda. Atualize a página.</p>
    );
  }
  if (calendar.loading) return <Skeleton className="h-[520px] rounded-[20px]" />;
  // overflow-clip (not hidden) keeps the grid's header sticky inside the page's scroll.
  const card = "relative overflow-clip rounded-[20px] border border-border bg-card";
  if (view === "mes") {
    return (
      <section aria-label="Mês" className={card}>
        <MonthGrid
          anchor={anchor}
          today={today}
          entries={entries}
          onOpenDay={(day) => calendar.goTo("dia", day)}
          onBookDay={onBookDay}
          onPick={handlers.onPick}
        />
      </section>
    );
  }
  const columns = gridColumns(view, anchor, entries, calendar.team, {
    owner: calendar.owner,
    single: isMobile,
  }).map((column) => ({
    ...column,
    onOpen: columnOpener(view, column, calendar),
  }));
  return (
    <section aria-label={view === "semana" ? "Semana" : "Dia"} className={card}>
      {view === "dia" ? (
        <DaySummary
          day={anchor}
          today={today}
          now={now}
          entries={entries}
          onPick={handlers.onPick}
        />
      ) : null}
      <TimeGrid
        columns={columns}
        view={view}
        hourHeight={hourHeight(calendar.zoom)}
        today={today}
        now={now}
        handlers={handlers}
      />
      {columns.every((column) => column.entries.length === 0) ? <EmptyNote view={view} /> : null}
    </section>
  );
}

function columnOpener(
  view: "semana" | "dia",
  column: { day: string; ownerId: string | null },
  calendar: AgendaCalendar,
) {
  if (view === "semana") return () => calendar.goTo("dia", column.day);
  if (!column.ownerId || calendar.owner) return null;
  return () => calendar.setOwner(column.ownerId);
}

function EmptyNote({ view }: { view: "semana" | "dia" }) {
  return (
    <div className="pointer-events-none absolute top-[45%] left-1/2 z-[6] grid w-[340px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 justify-items-center gap-2 rounded-[20px] border border-border bg-card p-6 text-center">
      <h3 className="text-base font-semibold">
        {view === "semana" ? "Nada marcado nesta semana" : "Nada marcado neste dia"}
      </h3>
      <p className="text-sm text-muted-foreground">
        Clique num horário vago para marcar uma reunião.
      </p>
    </div>
  );
}
