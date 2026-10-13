import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon, BotIcon, CheckIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState, IconTile, Lift, ProgressRing } from "@/components/apple-ui";
import { Page, Stat, useOpenNewSearch } from "@/components/app-shell";
import { SearchStatusBadge } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Search } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { searchesQuery } from "@/lib/queries";
import { errorToast } from "@/lib/mutation-toasts";
import { cn } from "@/lib/utils";
import { cancelSearch } from "@/server/searches";
import { pageTitle } from "@/lib/page-title";

export const Route = createFileRoute("/searches/")({
  head: () => ({ meta: [{ title: pageTitle("Buscas") }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(searchesQuery),
  component: SearchesPage,
});

function SearchesPage() {
  const { data } = useSuspenseQuery(searchesQuery);
  const openNewSearch = useOpenNewSearch();
  const found = data.reduce((sum, search) => sum + search.foundCount, 0);
  const running = data.filter(
    (search) => search.status === "collecting" || search.status === "analyzing",
  ).length;
  return (
    <Page
      title="Buscas"
      actions={
        <Button onClick={openNewSearch}>
          <PlusIcon />
          Busca manual
        </Button>
      }
      description={
        data.length > 0 ? (
          <>
            <Stat value={data.length}>{data.length === 1 ? "busca" : "buscas"}</Stat>
            {" · "}
            <Stat value={found} tone="green">
              leads novos
            </Stat>
            {running > 0 ? (
              <>
                {" · "}
                <Stat value={running} tone="purple">
                  em andamento
                </Stat>
              </>
            ) : null}
          </>
        ) : null
      }
    >
      {data.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          tone="purple"
          className="grouped bg-[radial-gradient(rgb(127_127_127/0.12)_1px,transparent_1px)] bg-size-[16px_16px]"
          title="Nenhuma busca ainda"
          description="O piloto automático e a busca manual aparecem aqui."
        >
          <Button onClick={openNewSearch}>
            <PlusIcon />
            Busca manual
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-3.5">
          {data.map((search, index) => (
            <SearchCard key={search.id} search={search} index={index} />
          ))}
        </div>
      )}
    </Page>
  );
}

function SearchCard({ search, index }: { search: Search; index: number }) {
  const processed = search.analyzedCount + search.errorCount;
  const running = search.status === "collecting" || search.status === "analyzing";
  const auto = search.origin === "autopilot";
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => cancelSearch({ data: { id: search.id } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast("Busca cancelada", {
        description: "O que já foi coletado e analisado continua nos leads.",
      });
    },
    onError: errorToast("Não foi possível cancelar a busca"),
  });
  return (
    <Lift
      className="grouped enter cursor-default"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <IconTile icon={auto ? BotIcon : SearchIcon} tone={auto ? "purple" : "blue"} size={30} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-medium">
              {search.niche} em {search.city}
            </span>
            <span className="rounded-full bg-fill-2 px-2 py-px text-[11.5px] font-medium text-muted-foreground tabular-nums">
              {search.foundCount} {search.foundCount === 1 ? "lead" : "leads"}
            </span>
          </p>
          <p className="text-xs font-light text-tertiary">
            <span className={cn("font-medium", auto ? "text-purple" : "text-blue")}>
              {auto ? "Automática" : "Manual"}
            </span>
            {" · "}
            {formatDate(search.createdAt, true)}
            {" · "}
            {search.placesRequests} {search.placesRequests === 1 ? "requisição" : "requisições"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-red"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Cancelando…" : "Cancelar"}
            </Button>
          ) : null}
          <SearchStatusBadge status={search.status} />
          {search.foundCount > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/leads" search={{ view: "all", searchId: search.id }}>
                Ver leads
                <ArrowRightIcon />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {running || search.status === "error" ? (
        <div className="grid gap-2.5 px-3.5 pb-3.5 sm:grid-cols-3">
          <Step
            state={
              search.status === "collecting"
                ? "running"
                : search.status === "error" && search.foundCount === 0
                  ? "error"
                  : "done"
            }
            title="Coleta no Google Maps"
          >
            {search.status === "error" && search.foundCount === 0 ? (
              search.errorMessage
            ) : (
              <>
                <b>{search.foundCount}</b>{" "}
                {search.foundCount === 1 ? "empresa nova" : "empresas novas"}
                {search.duplicateCount > 0 ? ` · ${search.duplicateCount} já existiam` : ""}
              </>
            )}
          </Step>
          <Step
            state={
              search.status === "analyzing"
                ? "running"
                : search.status === "error" && search.foundCount > 0
                  ? "error"
                  : search.status === "collecting" || search.foundCount === 0
                    ? "pending"
                    : "done"
            }
            title="Análise com IA"
            progress={
              search.status === "analyzing" && search.foundCount > 0
                ? (processed / search.foundCount) * 100
                : undefined
            }
          >
            {search.status === "error" && search.foundCount > 0 ? (
              search.errorMessage
            ) : search.status === "analyzing" ? (
              <>
                <b>{processed}</b> de {search.foundCount} analisadas
              </>
            ) : null}
          </Step>
          <Step state="pending" title="Concluída" />
        </div>
      ) : (
        <p className="flex items-center gap-2 border-t border-border/70 px-4 py-2.5 pl-[58px] text-[12.5px] font-light text-muted-foreground">
          {search.status === "cancelled" ? (
            <XIcon className="size-3.5 text-gray" strokeWidth={2.6} />
          ) : (
            <CheckIcon className="size-3.5 text-green" strokeWidth={2.6} />
          )}
          <span>
            <b className="font-medium text-foreground tabular-nums">{search.foundCount}</b>{" "}
            {search.foundCount === 1 ? "empresa nova" : "empresas novas"} ·{" "}
            <b className="font-medium text-foreground tabular-nums">{search.analyzedCount}</b>{" "}
            analisadas
            {search.duplicateCount > 0 ? (
              <>
                {" · "}
                <b className="font-medium text-foreground tabular-nums">
                  {search.duplicateCount}
                </b>{" "}
                já existiam
              </>
            ) : null}
            {search.errorCount > 0 ? (
              <span className="font-medium text-red"> · {search.errorCount} com erro</span>
            ) : null}
          </span>
        </p>
      )}
    </Lift>
  );
}

type StepState = "pending" | "running" | "done" | "error";

function Step({
  state,
  title,
  progress,
  children,
}: {
  state: StepState;
  title: string;
  progress?: number;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid content-start gap-1.5 rounded-xl bg-fill-3 p-3 transition-colors [.lift:hover_&]:bg-fill-2",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 font-medium",
          state === "done" && "text-foreground",
          state === "running" && "text-purple",
          state === "error" && "text-red",
          state === "pending" && "text-tertiary",
        )}
      >
        {state === "done" ? (
          <span className="grid size-5 place-items-center rounded-full bg-green text-primary-foreground">
            <CheckIcon className="size-3" strokeWidth={3} />
          </span>
        ) : state === "error" ? (
          <span className="grid size-5 place-items-center rounded-full bg-red text-white">
            <XIcon className="size-3" strokeWidth={3} />
          </span>
        ) : state === "running" ? (
          <ProgressRing
            value={progress ?? 30}
            tone="purple"
            size={20}
            thickness={3}
            track="var(--card)"
          />
        ) : (
          <span className="size-5 rounded-full shadow-[inset_0_0_0_1.5px_var(--text-quaternary)]" />
        )}
        {title}
      </p>
      {children ? (
        <p
          className={cn(
            "text-[12.5px] font-light [&_b]:font-medium [&_b]:text-foreground",
            state === "error" ? "text-red" : "text-muted-foreground",
          )}
        >
          {children}
        </p>
      ) : null}
      {progress !== undefined ? (
        <Progress
          value={progress}
          aria-label="Progresso da análise"
          className="mt-1 [--bar:var(--purple)]"
        />
      ) : null}
    </div>
  );
}
