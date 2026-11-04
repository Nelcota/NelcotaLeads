import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AgendaDays } from "@/components/agenda/agenda-days";
import { AgendaTiles } from "@/components/agenda/agenda-tiles";
import { Page } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { agendaTiles, groupAgenda } from "@/lib/agenda";
import { pageTitle } from "@/lib/page-title";
import { agendaQuery } from "@/lib/queries";
import { idSchema, lenientSearch } from "@/lib/schemas";
import type { Agenda } from "@/server/agenda";

const searchSchema = lenientSearch(z.object({ owner: idSchema.optional() }));

const EVERYONE = "all";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: pageTitle("Agenda") }] }),
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ owner: search.owner ?? null }),
  loader: ({ context, deps }) => context.queryClient.prefetchQuery(agendaQuery(deps.owner)),
  component: AgendaPage,
});

function AgendaPage() {
  const { owner } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isError } = useQuery(agendaQuery(owner ?? null));
  const setOwner = (value: string) =>
    void navigate({ search: { owner: value === EVERYONE ? undefined : value }, replace: true });

  return (
    <Page
      title="Agenda"
      description="Reuniões e retornos de hoje até as próximas duas semanas, em horário de Brasília."
      actions={
        <OwnerFilter value={owner ?? EVERYONE} team={data?.team ?? []} onChange={setOwner} />
      }
    >
      <AgendaBody data={data} failed={isError} />
    </Page>
  );
}

function AgendaBody({ data, failed }: { data: Agenda | undefined; failed: boolean }) {
  if (!data && failed) {
    return (
      <p className="text-sm font-light text-red">
        Não foi possível carregar a agenda. Atualize a página.
      </p>
    );
  }
  if (!data) {
    return (
      <>
        <Skeleton className="h-28 rounded-[20px]" />
        <Skeleton className="h-64 rounded-[20px]" />
      </>
    );
  }
  return (
    <>
      <AgendaTiles tiles={agendaTiles(data.entries, data.summary, data.today)} />
      <AgendaDays days={groupAgenda(data.entries, data.today)} today={data.today} />
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
      <SelectContent>
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
