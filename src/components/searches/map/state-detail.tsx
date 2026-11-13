import { ArrowLeftIcon, SearchIcon } from "lucide-react";
import { MapNumbers } from "@/components/searches/map/map-numbers";
import { RunningSearches } from "@/components/searches/map/running-searches";
import { Button } from "@/components/ui/button";
import { stateByCode, type StateCode } from "@/lib/brazil-states";
import { dayMonth, formatCount, localDay } from "@/lib/format";
import { isSearchRunning } from "@/lib/search-list";
import { searchesInState, stateYield } from "@/lib/search-map";
import type { SearchWithState } from "@/lib/search-state";
import { searchLabel } from "@/lib/searches";

/** Finished searches listed under the numbers. */
const RECENT_ROWS = 3;

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
  const inState = searchesInState(searches, code);
  const running = inState.filter((search) => isSearchRunning(search.status));
  const recent = inState.filter((search) => !isSearchRunning(search.status)).slice(0, RECENT_ROWS);
  const newLeads = inState.reduce((sum, search) => sum + search.foundCount, 0);
  const share = stateYield(inState);

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
          { label: "Buscas", value: formatCount(inState.length) },
          { label: "Leads novos", value: formatCount(newLeads) },
          {
            label: "Aproveitamento",
            value: share === null ? "—" : `${share}%`,
            hint: "Empresas novas sobre o total encontrado no Google",
          },
        ]}
      />
      {running.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <i aria-hidden className="map-legend-route" />
            Buscando agora
          </h4>
          <RunningSearches searches={running} />
        </div>
      ) : null}
      {recent.length > 0 ? (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-muted-foreground">Últimas buscas em {code}</h4>
          <ul className="divide-y divide-border">
            {recent.map((search) => (
              <li
                key={search.id}
                className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_72px] items-center gap-3 text-sm"
              >
                <span className="truncate font-medium">{searchLabel(search)}</span>
                <span className="text-tertiary tabular-nums">
                  {dayMonth(localDay(search.createdAt))}
                </span>
                <span className="text-right text-muted-foreground">
                  <b className="font-semibold text-foreground tabular-nums">
                    {formatCount(search.foundCount)}
                  </b>{" "}
                  {search.foundCount === 1 ? "lead" : "leads"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {inState.length === 0 ? (
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
