import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlarmClockIcon, CalendarDaysIcon, CalendarIcon } from "lucide-react";
import { TodaysAgendaGroup } from "@/components/overview/todays-agenda-group";
import { Button } from "@/components/ui/button";
import { todaysAgenda, todaysAgendaCount } from "@/lib/agenda";
import { todayAgendaQuery } from "@/lib/queries";

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
        <h2 id="todays-agenda" className="flex items-center gap-2 text-[18px] font-semibold">
          <CalendarIcon aria-hidden strokeWidth={2} className="size-[18px] shrink-0 text-blue" />
          Agenda de hoje
        </h2>
        {count ? (
          <span className="rounded-full bg-fill-2 px-2 py-px text-xs font-bold text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
        <span className="min-w-0 flex-1" />
        <Button asChild size="sm" className="shrink-0">
          <Link to="/agenda">
            <CalendarIcon aria-hidden strokeWidth={2} />
            Abrir agenda
          </Link>
        </Button>
      </div>
      {count ? (
        <>
          <TodaysAgendaGroup
            title="Atrasados"
            icon={AlarmClockIcon}
            iconClassName="text-red"
            entries={groups.overdue}
            today={data.today}
          />
          <TodaysAgendaGroup
            title="Hoje"
            icon={CalendarDaysIcon}
            iconClassName="text-muted-foreground"
            entries={groups.today}
            today={data.today}
          />
        </>
      ) : (
        <p className="border-t border-border/60 px-5 py-3.5 text-sm text-muted-foreground">
          Nenhuma reunião ou retorno para hoje.
        </p>
      )}
    </section>
  );
}
