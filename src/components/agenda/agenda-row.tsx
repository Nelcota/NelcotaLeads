import { Link } from "@tanstack/react-router";
import { AlarmClockIcon, CalendarIcon, RotateCcwIcon } from "@/components/icons";
import { StatusLabel } from "@/components/status-label";
import { agendaDetail, agendaWhen, type AgendaEntry } from "@/lib/agenda";
import { cn } from "@/lib/utils";

/** What the row is: a meeting, a follow-up, or a follow-up whose day has passed. */
function AgendaKind({ meeting, overdue }: { meeting: boolean; overdue: boolean }) {
  if (meeting) {
    return (
      <StatusLabel icon={CalendarIcon} tone="blue">
        Reunião
      </StatusLabel>
    );
  }
  if (overdue) {
    return (
      <StatusLabel icon={AlarmClockIcon} tone="red">
        Retorno atrasado
      </StatusLabel>
    );
  }
  return (
    <StatusLabel icon={RotateCcwIcon} tone="orange">
      Retorno
    </StatusLabel>
  );
}

/**
 * One meeting or follow-up: the time ("dia todo" for a follow-up, its day in red when overdue), the
 * lead, what it is, and whether it is late. The whole row opens the lead.
 */
export function AgendaRow({ entry, today }: { entry: AgendaEntry; today: string }) {
  const meeting = entry.kind === "meeting";
  const overdue = entry.day < today;
  const when = agendaWhen(entry, today);
  return (
    <Link
      to="/leads"
      search={{ view: "all", lead: entry.leadId }}
      className="flex min-h-[56px] items-center gap-3 border-t border-border/60 px-5 py-2.5 transition-colors outline-none hover:bg-fill-3 focus-visible:bg-fill-2"
    >
      <span
        className={cn("w-14 shrink-0 text-sm font-semibold tabular-nums", overdue && "text-red")}
      >
        {entry.time ? (
          when
        ) : (
          <span
            className={cn("text-xs font-medium", overdue ? "text-red" : "text-muted-foreground")}
          >
            {when}
          </span>
        )}
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-semibold">{entry.leadName}</span>
        <span className="truncate text-sm text-muted-foreground">{agendaDetail(entry)}</span>
      </span>
      <AgendaKind meeting={meeting} overdue={overdue} />
      <span className="shrink-0 text-base font-semibold text-blue max-sm:hidden">Abrir lead</span>
    </Link>
  );
}
