import { ArrowLeftIcon, SearchIcon } from "@/components/icons";
import { MapNumbers } from "@/components/searches/map/map-numbers";
import { RunningSearches } from "@/components/searches/map/running-searches";
import { Button } from "@/components/ui/button";
import { stateByCode, type StateCode } from "@/lib/brazil-states";
import { dayMonth, formatCount, localDay, pluralize } from "@/lib/format";
import { summarizeState } from "@/lib/search-map";
import type { SearchWithState } from "@/lib/search-state";
import { searchLabel } from "@/lib/searches";

/**
 * The panel next to the map for one state: its numbers, what runs there now, its last
 * searches and a new search in its capital. The Histórico below shows only this state.
 */
export function StateDetail({
  code,
  searches,
  quotaSpent,
  onBack,
  onSearchIn,
}: {
  code: StateCode;
  searches: readonly SearchWithState[];
  quotaSpent: boolean;
  onBack: () => void;
  onSearchIn: (city: string) => void;
}) {
  const state = stateByCode(code);
  const summary = summarizeState(searches, code);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-h-10 items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Voltar para o Brasil" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <h3 className="text-xl font-semibold">{state.name}</h3>
      </div>
      <MapNumbers
        numbers={[
          { label: "Buscas", value: formatCount(summary.searches) },
          { label: "Leads novos", value: formatCount(summary.newLeads) },
          {
            label: "Aproveitamento",
            value: summary.yieldPercent === null ? "—" : `${summary.yieldPercent}%`,
            hint: "Empresas novas sobre o total encontrado no Google",
          },
        ]}
      />
      {summary.running.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <i aria-hidden className="map-legend-route" />
            Buscando agora
          </h4>
          <RunningSearches searches={summary.running} />
        </div>
      ) : null}
      {summary.recent.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-muted-foreground">Últimas buscas em {code}</h4>
          <ul className="divide-y divide-border">
            {summary.recent.map((search) => (
              <li
                key={search.id}
                className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_72px] items-center gap-3 text-sm"
              >
                <span className="truncate font-medium">{searchLabel(search)}</span>
                <span className="text-tertiary tabular-nums">
                  {dayMonth(localDay(search.createdAt))}
                </span>
                <span className="text-right text-muted-foreground">
                  {pluralize(search.foundCount, "lead", "leads")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.searches === 0 ? (
        <p className="text-[15px] text-muted-foreground">Nenhuma busca em {state.name} ainda.</p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={quotaSpent}
        onClick={() => onSearchIn(state.capital)}
      >
        <SearchIcon />
        Buscar em {state.capital}
      </Button>
    </div>
  );
}
