import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AgendaBoard } from "@/components/agenda/agenda-board";
import type { MeetingTarget } from "@/components/agenda/meeting-dialog";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAgendaCalendar,
  type AgendaCalendar,
  type AgendaSearch,
} from "@/hooks/use-agenda-calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { calendarRange, calendarViewSchema, firstFreeSlot } from "@/lib/calendar";
import { localDay } from "@/lib/format";
import { pageTitle } from "@/lib/page-title";
import { agendaQuery } from "@/lib/queries";
import { daySchema, idSchema, lenientSearch } from "@/lib/schemas";

const searchSchema = lenientSearch(
  z.object({
    owner: idSchema.optional(),
    view: calendarViewSchema.optional(),
    date: daySchema.optional(),
  }),
);

const EVERYONE = "all";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: pageTitle("Agenda") }] }),
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    owner: search.owner ?? null,
    view: search.view ?? "semana",
    date: search.date ?? localDay(new Date()),
  }),
  loader: ({ context, deps }) => {
    const range = calendarRange(deps.view, deps.date);
    return context.queryClient.prefetchQuery(agendaQuery(deps.owner, range.from, range.to));
  },
  component: AgendaPage,
});

function AgendaPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const isMobile = useIsMobile();
  const setSearch = (next: AgendaSearch) => void navigate({ search: next, replace: true });
  const calendar = useAgendaCalendar(search, setSearch, isMobile);
  const [target, setTarget] = useState<MeetingTarget | null>(null);

  const bookNow = () => {
    const from = calendar.anchor < calendar.today ? calendar.today : calendar.anchor;
    const slot = firstFreeSlot(from, calendar.entries, calendar.today, calendar.now);
    setTarget({ mode: "book", day: slot.day, time: slot.time, leadId: "" });
  };

  return (
    <Page
      title="Agenda"
      description="Reuniões e retornos da equipe, em horário de Brasília."
      actions={<HeaderActions calendar={calendar} onBook={bookNow} />}
    >
      <AgendaBoard calendar={calendar} isMobile={isMobile} target={target} onTarget={setTarget} />
    </Page>
  );
}

function HeaderActions({ calendar, onBook }: { calendar: AgendaCalendar; onBook: () => void }) {
  return (
    <>
      {calendar.backLabel ? (
        <Button variant="ghost" size="sm" onClick={calendar.goBack} className="max-sm:hidden">
          <ChevronLeftIcon />
          {calendar.backLabel}
        </Button>
      ) : null}
      <OwnerFilter
        value={calendar.owner ?? EVERYONE}
        team={calendar.team}
        onChange={(value) => calendar.setOwner(value === EVERYONE ? null : value)}
      />
      <Button size="sm" onClick={onBook} aria-label="Marcar reunião">
        <PlusIcon />
        <span className="max-sm:hidden">Marcar reunião</span>
      </Button>
    </>
  );
}

function OwnerFilter({
  value,
  team,
  onChange,
}: {
  value: string;
  team: readonly { id: string; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-40" aria-label="De quem">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="shadow-none">
        <SelectItem value={EVERYONE}>Todos</SelectItem>
        {team.map((member) => (
          <SelectItem key={member.id} value={member.id}>
            {member.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
