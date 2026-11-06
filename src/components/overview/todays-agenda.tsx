import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AgendaRow } from "@/components/agenda/agenda-row";
import { dueToday, TODAY_AGENDA_LIMIT } from "@/lib/agenda";
import { todayAgendaQuery } from "@/lib/queries";

/**
 * "Agenda de hoje": overdue follow-ups, then today's meetings and follow-ups (the first few),
 * and "Abrir agenda".
 */
export function TodaysAgenda() {
  const { data } = useQuery(todayAgendaQuery);
  if (!data) return null;
  const entries = dueToday(data.entries, data.today);
  return (
    <section aria-labelledby="todays-agenda" className="grouped enter">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-5 pt-4 pb-2">
        <h2 id="todays-agenda" className="text-[17px] font-semibold">
          Agenda de hoje
        </h2>
        <span className="rounded-full bg-fill-2 px-2 py-px text-xs font-bold text-muted-foreground tabular-nums">
          {entries.length}
        </span>
        <span className="min-w-0 flex-1" />
        <Link to="/agenda" className="text-[13.5px] font-semibold text-blue hover:underline">
          Abrir agenda
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="border-t border-border/60 px-5 py-3.5 text-sm text-muted-foreground">
          Nenhuma reunião ou retorno para hoje.
        </p>
      ) : (
        entries
          .slice(0, TODAY_AGENDA_LIMIT)
          .map((entry) => <AgendaRow key={entry.id} entry={entry} today={data.today} />)
      )}
    </section>
  );
}
