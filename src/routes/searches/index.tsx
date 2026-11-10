import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  RotateCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { lenientSearch } from "@/lib/schemas";
import { EmptyState, Hint, IconTile, Lift, ProgressRing } from "@/components/apple-ui";
import { Page, Stat, useOpenNewSearch } from "@/components/app-shell";
import { SearchStatusBadge } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import type { Search } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { searchesQuery } from "@/lib/queries";
import { errorToast } from "@/lib/mutation-toasts";
import { useNotFoundToast } from "@/lib/not-found-toast";
import { searchFailureText } from "@/lib/provider-errors";
import { MANUAL_SEARCH_ID } from "@/lib/searches";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import { cancelSearch, hideSearch, repeatSearch } from "@/server/searches";
import { pageTitle } from "@/lib/page-title";

export const Route = createFileRoute("/searches/")({
  head: () => ({ meta: [{ title: pageTitle("Buscas") }] }),
  // `missing`: arrived from a link to a search that no longer exists.
  // `hidden`: the searches the user hid are listed below the others.
  validateSearch: lenientSearch(
    z.object({ missing: z.boolean().optional(), hidden: z.boolean().optional() }),
  ),
  loader: ({ context }) => context.queryClient.ensureQueryData(searchesQuery),
  component: SearchesPage,
});

function SearchesPage() {
  const { data: all } = useSuspenseQuery(searchesQuery);
  const { missing, hidden: showHidden } = Route.useSearch();
  const navigate = useNavigate({ from: "/searches/" });
  useNotFoundToast(
    missing,
    "Busca não encontrada",
    () => void navigate({ search: (prev) => ({ ...prev, missing: undefined }), replace: true }),
  );
  // Leads added by hand are filed under a fixed "search" that is not one (see Leads).
  const real = all.filter((search) => search.id !== MANUAL_SEARCH_ID);
  const data = real.filter((search) => !search.hiddenAt);
  const hidden = real.filter((search) => search.hiddenAt);
  const toggleHidden = () =>
    void navigate({
      search: (prev) => ({ ...prev, hidden: showHidden ? undefined : true }),
      replace: true,
    });
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
          Nova busca
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
      {data.length === 0 && hidden.length > 0 && !showHidden ? (
        <EmptyState
          icon={EyeOffIcon}
          tone="gray"
          className="grouped"
          title="Todas as buscas estão ocultas"
          description="Elas continuam guardadas, assim como os leads delas."
        >
          <Button variant="outline" onClick={toggleHidden}>
            <EyeIcon />
            Mostrar buscas ocultas
          </Button>
        </EmptyState>
      ) : data.length === 0 && hidden.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          tone="purple"
          className="grouped"
          title="Nenhuma busca ainda"
          description="As buscas diárias e as que você fizer aparecem aqui."
        >
          <Button onClick={openNewSearch}>
            <PlusIcon />
            Nova busca
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-3.5">
          {data.map((search, index) => (
            <SearchCard key={search.id} search={search} index={index} />
          ))}
          {hidden.length > 0 ? (
            <HiddenSearches searches={hidden} open={showHidden === true} onToggle={toggleHidden} />
          ) : null}
        </div>
      )}
    </Page>
  );
}

/** The searches the user hid: a toggle at the end of the list, then the cards, dimmed. */
function HiddenSearches({
  searches,
  open,
  onToggle,
}: {
  searches: Search[];
  open: boolean;
  onToggle: () => void;
}) {
  const count = searches.length;
  const label = count === 1 ? "1 busca oculta" : `${count} buscas ocultas`;
  return (
    <section aria-label="Buscas ocultas" className="grid gap-3.5">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        className="justify-self-center text-muted-foreground"
        onClick={onToggle}
      >
        {open ? <EyeOffIcon /> : <EyeIcon />}
        {open ? `Esconder ${label}` : `Mostrar ${label}`}
        <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open
        ? searches.map((search, index) => (
            <SearchCard key={search.id} search={search} index={index} />
          ))
        : null}
    </section>
  );
}

function SearchCard({ search, index }: { search: Search; index: number }) {
  const processed = search.analyzedCount + search.errorCount;
  const running = search.status === "collecting" || search.status === "analyzing";
  const today = useToday();
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
  const repeat = useRepeatSearch();
  const hide = useHideSearch();
  const unhide = useUnhideSearch();
  const isHidden = Boolean(search.hiddenAt);
  // The whole card opens the search's leads; its buttons sit above that link.
  const linked = search.foundCount > 0;
  const Card = linked ? Lift : "div";
  return (
    <Card
      className={cn("grouped enter relative", isHidden && "opacity-70 hover:opacity-100")}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {linked ? (
        <Link
          to="/leads"
          search={{ view: "all", searchId: search.id }}
          aria-label={`Ver leads: ${search.niche} em ${search.city}`}
          className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <IconTile icon={auto ? BotIcon : SearchIcon} tone={auto ? "purple" : "blue"} size={30} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-medium">
              {search.niche} em {search.city}
            </span>
            <span className="rounded-full bg-fill-2 px-2 py-px text-[13px] font-medium text-muted-foreground tabular-nums">
              {search.foundCount} {search.foundCount === 1 ? "lead" : "leads"}
            </span>
          </p>
          <p className="text-xs font-light text-tertiary">
            <span className={cn("font-medium", auto ? "text-purple" : "text-blue")}>
              {auto ? "Automática" : "Manual"}
            </span>
            {" · "}
            {formatDate(search.createdAt, true)}
          </p>
        </div>
        <div className="relative flex items-center gap-2">
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
          {isHidden ? (
            <Button
              variant="outline"
              size="sm"
              disabled={unhide.isPending}
              onClick={() => unhide.mutate(search.id)}
            >
              <EyeIcon />
              Mostrar na lista
            </Button>
          ) : (
            <SearchStatusBadge status={search.status} />
          )}
          {isHidden ? null : search.status === "error" ? (
            <Button size="sm" disabled={repeat.isPending} onClick={() => repeat.mutate(search.id)}>
              <RotateCwIcon />
              {repeat.isPending ? "Buscando…" : "Tentar de novo"}
            </Button>
          ) : linked ? (
            <ArrowRightIcon
              aria-hidden
              className="lift-go size-4 text-muted-foreground max-sm:hidden"
            />
          ) : null}
          {running ? null : (
            <DropdownMenu>
              <Hint label="Mais ações">
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
                    <EllipsisIcon />
                  </Button>
                </DropdownMenuTrigger>
              </Hint>
              <DropdownMenuContent align="end" className="w-auto min-w-40">
                <DropdownMenuItem
                  disabled={repeat.isPending}
                  onSelect={() => repeat.mutate(search.id)}
                >
                  <RotateCwIcon />
                  Repetir busca
                </DropdownMenuItem>
                {isHidden ? (
                  <DropdownMenuItem onSelect={() => unhide.mutate(search.id)}>
                    <EyeIcon />
                    Mostrar na lista
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => hide.mutate(search.id)}>
                    <EyeOffIcon />
                    Ocultar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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
              searchFailureText(search.errorMessage, search.createdAt, today)
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
        <p className="flex items-center gap-2 border-t border-border/70 px-4 py-2.5 pl-[58px] text-[14px] font-light text-muted-foreground">
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
    </Card>
  );
}

/** "Tentar de novo" and "Repetir busca": a new search with the same niche, city and size. */
function useRepeatSearch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => repeatSearch({ data: { id } }),
    onSuccess: async ({ searchId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
      ]);
      toast.success("Busca feita de novo", {
        description: "Os leads aparecem conforme a análise termina.",
        action: {
          label: "Ver leads",
          onClick: () => void navigate({ to: "/leads", search: { view: "all", searchId } }),
        },
      });
    },
    onError: errorToast("Não foi possível repetir a busca"),
  });
}

/** Hides the search from this list right away; its leads stay. Undo brings it back. */
function useHideSearch() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["searches"] });
  const undo = async (id: string) => {
    try {
      await hideSearch({ data: { id, hidden: false } });
      await refresh();
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };
  return useMutation({
    mutationFn: (id: string) => hideSearch({ data: { id, hidden: true } }),
    onSuccess: async (result, id) => {
      await refresh();
      const leads =
        result.leads === 0
          ? ""
          : ` ${result.leads === 1 ? "O lead continua" : `Os ${result.leads} leads continuam`} em Leads.`;
      toast("Busca ocultada", {
        description: `Para ver de novo, abra as buscas ocultas no fim da lista.${leads}`,
        action: { label: "Desfazer", onClick: () => void undo(id) },
      });
    },
    onError: errorToast("Não foi possível ocultar a busca"),
  });
}

/** "Mostrar na lista" on a hidden search: back among the others. */
function useUnhideSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hideSearch({ data: { id, hidden: false } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["searches"] });
      toast.success("Busca de volta na lista");
    },
    onError: errorToast("Não foi possível mostrar a busca"),
  });
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
            "text-[14px] font-light [&_b]:font-medium [&_b]:text-foreground",
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
