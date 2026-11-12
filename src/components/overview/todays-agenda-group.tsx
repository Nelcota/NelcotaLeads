import type { LucideIcon } from "lucide-react";
import { AgendaRow } from "@/components/agenda/agenda-row";
import { type AgendaEntry, TODAY_AGENDA_LIMIT } from "@/lib/agenda";
import { cn } from "@/lib/utils";

/** One group of the card: "Atrasados (3)" or "Hoje (1)", then its first few rows. */
export function TodaysAgendaGroup({
  title,
  icon: Icon,
  iconClassName,
  entries,
  today,
}: {
  title: string;
  icon: LucideIcon;
  /** The tone text class of the icon, e.g. "text-red". */
  iconClassName: string;
  entries: AgendaEntry[];
  today: string;
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div>
      <h3 className="flex items-center gap-1.5 border-t border-border/60 px-5 pt-3 pb-1.5 text-xs font-semibold text-muted-foreground tabular-nums">
        <Icon aria-hidden strokeWidth={2} className={cn("size-3.5 shrink-0", iconClassName)} />
        {title} ({entries.length})
      </h3>
      {entries.slice(0, TODAY_AGENDA_LIMIT).map((entry) => (
        <AgendaRow key={entry.id} entry={entry} today={today} />
      ))}
    </div>
  );
}
