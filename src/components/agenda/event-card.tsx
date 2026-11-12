import { LayersIcon } from "lucide-react";
import type { CSSProperties, DragEvent } from "react";
import { clock, type CalendarEntry } from "@/lib/calendar";
import { MEETING_KIND_LABELS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { EntryIcon } from "./entry-icon";

/** The id a dragged meeting carries, read back where it is dropped. */
export const DRAG_TYPE = "application/x-nelcota-meeting";

const cardClass =
  "absolute z-[2] flex items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-card px-2 text-left text-xs leading-4 transition-colors hover:bg-card-2 @max-[9.5rem]:gap-1 @max-[9.5rem]:px-1.5";

/** In a narrow column (the Week on a laptop) the icon gives its room to the lead's name. */
const narrowHidden = "@max-[9.5rem]:hidden";

/** A meeting on the Week or Day grid: neutral card, gray kind icon, time and lead. */
export function EventCard({
  entry,
  style,
  compact,
  detail,
  canDrag,
  onPick,
}: {
  entry: CalendarEntry;
  style: CSSProperties;
  compact: boolean;
  /** Shown after the lead where the column is wide (the Day view). */
  detail: string;
  canDrag: boolean;
  onPick: (entry: CalendarEntry) => void;
}) {
  const kind = entry.meetingKind ? MEETING_KIND_LABELS[entry.meetingKind] : "Reunião";
  const hint = [entry.leadName, kind, entry.ownerName, canDrag ? "arraste para remarcar" : ""]
    .filter(Boolean)
    .join(" · ");
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, entry.id);
    event.dataTransfer.effectAllowed = "move";
  };
  return (
    <button
      type="button"
      draggable={canDrag}
      onDragStart={canDrag ? onDragStart : undefined}
      onClick={() => onPick(entry)}
      title={hint}
      style={style}
      className={cn(
        cardClass,
        canDrag ? "cursor-grab" : "cursor-pointer",
        compact && "px-1.5 text-2xs leading-[14px]",
      )}
    >
      <EntryIcon kind={entry.meetingKind} className={cn(compact && "size-3", narrowHidden)} />
      <span className="shrink-0 font-semibold text-muted-foreground tabular-nums">
        {clock(entry.minutes ?? 0)}
      </span>
      <span className="min-w-0 truncate font-medium">{entry.leadName}</span>
      {detail ? (
        <span className="min-w-0 shrink-[100] truncate text-muted-foreground">· {detail}</span>
      ) : null}
    </button>
  );
}

/** Meetings at the same time on the Week: one full-width card that opens the list. */
export function GroupCard({
  entries,
  style,
  compact,
  onPick,
}: {
  entries: readonly CalendarEntry[];
  style: CSSProperties;
  compact: boolean;
  onPick: (entries: readonly CalendarEntry[]) => void;
}) {
  const minutes = entries[0]?.minutes ?? 0;
  return (
    <button
      type="button"
      onClick={() => onPick(entries)}
      title={`${entries.map((entry) => entry.leadName).join(" · ")} · clique para ver`}
      style={style}
      className={cn(cardClass, "cursor-pointer", compact && "px-1.5 text-2xs leading-[14px]")}
    >
      <LayersIcon
        aria-hidden
        className={cn("size-3.5 shrink-0 text-muted-foreground", narrowHidden)}
      />
      <span className="shrink-0 font-semibold text-muted-foreground tabular-nums">
        {clock(minutes)}
      </span>
      <span className="min-w-0 truncate font-medium">{entries.length} reuniões</span>
    </button>
  );
}
