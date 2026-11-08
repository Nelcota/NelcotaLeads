import { Button } from "@/components/ui/button";
import { dayMonth, localDay, localTime } from "@/lib/format";
import { agendaDayLabel } from "@/lib/agenda";
import { MEETING_KIND_LABELS } from "@/lib/schemas";
import type { UpcomingMeeting } from "@/server/meeting-store";

/** The lead's meetings from today on, each with "Cancelar". */
export function LeadMeetings({
  meetings,
  today,
  busy,
  onCancel,
}: {
  meetings: readonly UpcomingMeeting[];
  today: string;
  busy: boolean;
  onCancel: (id: string) => void;
}) {
  if (meetings.length === 0) return null;
  return (
    <ol className="grouped grid text-sm">
      {meetings.map((meeting) => {
        const day = localDay(meeting.startsAt);
        const when = `${agendaDayLabel(day, today)} · ${localTime(meeting.startsAt)}`;
        return (
          <li
            key={meeting.id}
            className="grouped-row flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 [--inset:16px]"
          >
            <span className="grid min-w-0 flex-1">
              <span className="font-medium tabular-nums" title={dayMonth(day)}>
                {when}
              </span>
              <span className="truncate text-xs font-light text-muted-foreground">
                {[MEETING_KIND_LABELS[meeting.kind], meeting.note].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => onCancel(meeting.id)}
            >
              Cancelar
            </Button>
          </li>
        );
      })}
    </ol>
  );
}
