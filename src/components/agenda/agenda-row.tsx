import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { agendaDetail, agendaWhen, type AgendaEntry } from "@/lib/agenda";

/**
 * One meeting or follow-up: the time ("dia todo" for a follow-up, its day when overdue), the
 * lead, what it is and a chip, Reunião (blue) or Retorno (orange). The whole row opens the lead.
 */
export function AgendaRow({ entry, today }: { entry: AgendaEntry; today: string }) {
  const meeting = entry.kind === "meeting";
  const when = agendaWhen(entry, today);
  return (
    <Link
      to="/leads"
      search={{ view: "all", lead: entry.leadId }}
      className="flex min-h-[56px] items-center gap-3 border-t border-border/60 px-5 py-2.5 transition-colors outline-none hover:bg-fill-3 focus-visible:bg-fill-2"
    >
      <span className="w-14 shrink-0 text-sm font-semibold tabular-nums">
        {entry.time ? (
          when
        ) : (
          <span
            className={
              entry.day < today
                ? "text-xs font-medium text-orange"
                : "text-xs font-medium text-muted-foreground"
            }
          >
            {when}
          </span>
        )}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-semibold">{entry.leadName}</span>
        <span className="truncate text-[14px] text-muted-foreground">{agendaDetail(entry)}</span>
      </span>
      <Badge variant={meeting ? "blue" : "orange"}>{meeting ? "Reunião" : "Retorno"}</Badge>
      <span className="shrink-0 text-[15px] font-semibold text-blue max-sm:hidden">Abrir lead</span>
    </Link>
  );
}
