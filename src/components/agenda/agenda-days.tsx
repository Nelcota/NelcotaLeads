import { CalendarIcon } from "lucide-react";
import { EmptyState } from "@/components/apple-ui";
import type { AgendaDay } from "@/lib/agenda";
import { AgendaRow } from "./agenda-row";

/**
 * The agenda by day (Atrasados, Hoje, Amanhã, then weekday names), each day its own group.
 */
export function AgendaDays({ days, today }: { days: readonly AgendaDay[]; today: string }) {
  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarIcon}
        tone="gray"
        title="Nada marcado nos próximos dias"
        description="Reuniões marcadas no lead e datas de retorno aparecem aqui."
      />
    );
  }
  return (
    <div className="grid gap-4">
      {days.map((day) => (
        <section key={day.day} aria-label={day.label} className="grouped enter">
          <h2 className="flex items-baseline gap-2 px-5 pt-3.5 pb-2 text-[15px] font-semibold">
            {day.label}
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {day.entries.length}
            </span>
          </h2>
          {day.entries.map((entry) => (
            <AgendaRow key={entry.id} entry={entry} today={today} />
          ))}
        </section>
      ))}
    </div>
  );
}
