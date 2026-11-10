import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AgendaRow } from "@/components/agenda/agenda-row";
import { Button } from "@/components/ui/button";
import {
  type AgendaEntry,
  TODAY_AGENDA_LIMIT,
  todaysAgenda,
  todaysAgendaCount,
} from "@/lib/agenda";
import { todayAgendaQuery } from "@/lib/queries";

/** One group of the card: "Atrasados (3)" or "Hoje (1)", then its first few rows. */
function TodaysAgendaGroup({
  title,
  entries,
  today,
}: {
  title: string;
  entries: AgendaEntry[];
  today: string;
}) {
  if (entries.length === 0) return null;
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

/**
 * "Agenda de hoje": the overdue follow-ups in their own group on top, then today's meetings and
 * follow-ups (the first few of each), and "Abrir agenda".
 */
export function TodaysAgenda() {
  const { data } = useQuery(todayAgendaQuery);
  if (!data) return null;
  const groups = todaysAgenda(data.entries, data.today);
  const count = todaysAgendaCount(groups);
  return (
    <section aria-labelledby="todays-agenda" className="grouped enter">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-5 pt-4 pb-2">
        <h2 id="todays-agenda" className="text-[18px] font-semibold">
          Agenda de hoje
        </h2>
        {count ? (
          <span className="rounded-full bg-fill-2 px-2 py-px text-xs font-bold text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
        <span className="min-w-0 flex-1" />
        <Button asChild size="sm" className="shrink-0">
          <Link to="/agenda">Abrir agenda</Link>
        </Button>
      </div>
      {count ? (
        <>
          <TodaysAgendaGroup title="Atrasados" entries={groups.overdue} today={data.today} />
          <TodaysAgendaGroup title="Hoje" entries={groups.today} today={data.today} />
        </>
      ) : (
        <p className="border-t border-border/60 px-5 py-3.5 text-sm text-muted-foreground">
          Nenhuma reunião ou retorno para hoje.
        </p>
      )}
    </section>
  );
}
