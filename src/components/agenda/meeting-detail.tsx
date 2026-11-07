import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlusIcon, ChevronLeftIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { clock, longDay, MEETING_MINUTES, relativeWhen, type CalendarEntry } from "@/lib/calendar";
import { MEETING_KIND_LABELS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { EntryIcon } from "./entry-icon";

/** The dialogs of the Agenda: solid, a 1px border, no shadow. */
export const AGENDA_DIALOG = "gap-3.5 border border-border p-5 shadow-none sm:max-w-[400px]";

/**
 * A meeting's or follow-up's detail: the time first (with when it is from now), then the lead,
 * who has it and the note. A meeting can be rescheduled or cancelled; a follow-up can get a
 * meeting booked.
 */
export function MeetingDetail({
  entry,
  today,
  now,
  backLabel,
  busy,
  onBack,
  onClose,
  onReschedule,
  onCancel,
  onBook,
}: {
  entry: CalendarEntry;
  today: string;
  now: string;
  backLabel: string;
  busy: boolean;
  onBack: () => void;
  onClose: () => void;
  onReschedule: (entry: CalendarEntry) => void;
  onCancel: (entry: CalendarEntry) => void;
  onBook: (entry: CalendarEntry) => void;
}) {
  const meeting = entry.minutes !== null;
  const when = relativeWhen(entry, today, now);
  const time = meeting
    ? `${clock(entry.minutes ?? 0)} – ${clock((entry.minutes ?? 0) + MEETING_MINUTES)}`
    : "Dia todo";
  const kind = entry.meetingKind ? MEETING_KIND_LABELS[entry.meetingKind] : "Retornar o contato";
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent showCloseButton={false} className={AGENDA_DIALOG}>
        <button
          type="button"
          onClick={onBack}
          className="-mt-1.5 -ml-2 inline-flex h-8 items-center gap-1 self-start rounded-full pr-3 pl-1.5 text-[14px] font-semibold text-primary transition-colors hover:bg-fill-2"
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
          {backLabel}
        </button>
        <div className="flex items-start gap-2">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[14px] font-semibold",
                when.today ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {when.text}
            </span>
            <DialogTitle className="text-[30px] leading-[38px] font-semibold tracking-[-0.02em] tabular-nums">
              {time}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {longDay(entry.overdueFrom ?? entry.day)}
            </DialogDescription>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="grid gap-1 rounded-[14px] border border-border bg-card px-3.5 py-3">
          <p className="text-base font-semibold">{entry.leadName}</p>
          <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground">
            <EntryIcon kind={entry.meetingKind} />
            {kind}
          </span>
        </div>
        <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{meeting ? "Com" : "Quem"}</dt>
          <dd className="font-medium">{entry.ownerName ?? "Sem responsável"}</dd>
          {entry.note ? (
            <>
              <dt className="text-muted-foreground">Nota</dt>
              <dd>{entry.note}</dd>
            </>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/leads" search={{ view: "all", lead: entry.leadId }}>
              Abrir lead
            </Link>
          </Button>
          {meeting ? (
            <>
              <Button variant="secondary" disabled={busy} onClick={() => onReschedule(entry)}>
                <CalendarPlusIcon />
                Remarcar
              </Button>
              <CancelMeeting busy={busy} onConfirm={() => onCancel(entry)} />
            </>
          ) : (
            <Button variant="secondary" onClick={() => onBook(entry)}>
              Marcar reunião
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Cancelar reunião" asks once more before cancelling: it cannot be undone. */
function CancelMeeting({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  const red = "text-red hover:bg-red/15 hover:text-red";
  if (!asking) {
    return (
      <Button variant="ghost" className={red} disabled={busy} onClick={() => setAsking(true)}>
        Cancelar reunião
      </Button>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      role="group"
      aria-label="Confirmar cancelamento"
    >
      <Button variant="destructive" disabled={busy} onClick={onConfirm} autoFocus>
        Sim, cancelar
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
        Manter
      </Button>
    </span>
  );
}

/** The outline close button of the Agenda's dialogs. */
export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Fechar"
      title="Fechar (Esc)"
      onClick={onClose}
      className="-mt-1 -mr-1.5 grid size-9 shrink-0 place-items-center rounded-full border border-border text-foreground transition-[background-color,transform] duration-150 hover:bg-fill-2 active:scale-[0.94]"
    >
      <XIcon aria-hidden className="size-3.5" strokeWidth={1.8} />
    </button>
  );
}
