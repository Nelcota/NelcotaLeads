import { MapIcon } from "@/components/icons";
import { BrazilMap } from "@/components/searches/map/brazil-map";
import { MapOverview } from "@/components/searches/map/map-overview";
import { StateDetail } from "@/components/searches/map/state-detail";
import type { StateCode } from "@/lib/brazil-states";
import { summarizeBrazil } from "@/lib/search-map";
import type { SearchWithState } from "@/lib/search-state";

/**
 * "Onde você buscou": the map of Brazil next to a panel with Brasil's numbers or, once a state
 * is chosen (on the map, the picker or the ranking), that state's.
 */
export function SearchMap({
  searches,
  chosen,
  quotaSpent,
  onChoose,
  onShowRunning,
  onSearchIn,
}: {
  searches: readonly SearchWithState[];
  chosen: StateCode | undefined;
  quotaSpent: boolean;
  onChoose: (code: StateCode | undefined) => void;
  onShowRunning: () => void;
  onSearchIn: (city: string) => void;
}) {
  const summary = summarizeBrazil(searches);

  return (
    <section aria-labelledby="mapa" className="grouped @container min-w-0">
      <div className="border-b border-border p-5">
        <h2 id="mapa" className="flex items-center gap-2 text-lg font-semibold">
          <MapIcon aria-hidden className="size-[18px] shrink-0 text-blue" />
          Onde você buscou
        </h2>
      </div>
      <div className="grid gap-8 p-5 @4xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <BrazilMap stats={summary.stats} chosen={chosen} onChoose={onChoose} />
          <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="map-legend-route" />
              Buscando agora
            </span>
            <span className="text-tertiary">Clique num estado para filtrar o Histórico</span>
          </p>
        </div>
        {chosen ? (
          <StateDetail
            code={chosen}
            searches={searches}
            quotaSpent={quotaSpent}
            onBack={() => onChoose(undefined)}
            onSearchIn={onSearchIn}
          />
        ) : (
          <MapOverview summary={summary} onChoose={onChoose} onShowRunning={onShowRunning} />
        )}
      </div>
    </section>
  );
}
