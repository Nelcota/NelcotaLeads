import { ChevronRightIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { clock, longDay, type CalendarEntry } from "@/lib/calendar";
import { MEETING_KIND_LABELS } from "@/lib/schemas";
import { EntryIcon } from "./entry-icon";
import { AGENDA_DIALOG, CloseButton } from "./meeting-detail";

/** "2 reuniões às 14:00": the meetings of a grouped card on the Week, each opening its detail. */
export function MeetingGroup({
  entries,
  onPick,
  onClose,
}: {
  entries: readonly CalendarEntry[];
  onPick: (entry: CalendarEntry) => void;
  onClose: () => void;
}) {
  const first = entries[0];
  if (!first) return null;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent showCloseButton={false} className={AGENDA_DIALOG}>
        <div className="flex items-start gap-2">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <DialogTitle className="text-lg font-semibold">
              {entries.length} reuniões às {clock(first.minutes ?? 0)}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {longDay(first.day)}
            </DialogDescription>
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="grid gap-1.5">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry)}
              className="flex min-h-14 items-center gap-3 rounded-[14px] border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-card-2"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fill-2">
                <EntryIcon kind={entry.meetingKind} />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-semibold">{entry.leadName}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {[
                    entry.meetingKind ? MEETING_KIND_LABELS[entry.meetingKind] : null,
                    entry.ownerName ? `com ${entry.ownerName}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-tertiary" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
