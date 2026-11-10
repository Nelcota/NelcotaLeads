import { AgendaRow } from "@/components/agenda/agenda-row";
import { type AgendaEntry, TODAY_AGENDA_LIMIT } from "@/lib/agenda";

/** One group of the card: "Atrasados (3)" or "Hoje (1)", then its first few rows. */
export function TodaysAgendaGroup({
  title,
  entries,
  today,
}: {
  title: string;
  entries: AgendaEntry[];
  today: string;
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div>
      <h3 className="border-t border-border/60 px-5 pt-3 pb-1.5 text-[13px] font-semibold text-muted-foreground tabular-nums">
        {title} ({entries.length})
      </h3>
      {entries.slice(0, TODAY_AGENDA_LIMIT).map((entry) => (
        <AgendaRow key={entry.id} entry={entry} today={today} />
      ))}
    </div>
  );
}
