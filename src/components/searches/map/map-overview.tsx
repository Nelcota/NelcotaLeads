import { useState } from "react";
import { MapNumbers } from "@/components/searches/map/map-numbers";
import { StatePicker } from "@/components/searches/map/state-picker";
import { StateRankingRow } from "@/components/searches/map/state-ranking-row";
import { Button } from "@/components/ui/button";
import type { StateCode } from "@/lib/brazil-states";
import { formatCount } from "@/lib/format";
import { rankStates, runningPlaces, type StateStats } from "@/lib/search-map";

/**
 * The panel next to the map with no state chosen: Brasil's numbers, what runs now, and the
 * states ranked by new leads; a row opens to its running searches.
 */
export function MapOverview({
  stats,
  onChoose,
  onShowRunning,
}: {
  stats: ReadonlyMap<StateCode, StateStats>;
  onChoose: (code: StateCode) => void;
  onShowRunning: () => void;
}) {
  const [openRow, setOpenRow] = useState<StateCode | null>(null);
  const ranked = rankStates(stats);
  const running = ranked.flatMap((row) => row.stats.running);
  const totalSearches = ranked.reduce((sum, row) => sum + row.stats.searches, 0);
  const totalLeads = ranked.reduce((sum, row) => sum + row.stats.newLeads, 0);
  const topLeads = ranked[0]?.stats.newLeads ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-xl font-semibold">Brasil</h3>
        <StatePicker stats={stats} onPick={onChoose} />
      </div>
      <MapNumbers
        numbers={[
          { label: "Buscas", value: formatCount(totalSearches) },
          { label: "Leads novos", value: formatCount(totalLeads) },
          {
            label: "Estados",
            value: `${ranked.length} de 27`,
            hint: "Estados com pelo menos uma busca",
          },
        ]}
      />
      {running.length > 0 ? (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-3"
        >
          <i aria-hidden className="map-legend-route" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {running.length === 1 ? "1 busca" : `${running.length} buscas`} em andamento
            </p>
            <p className="truncate text-xs text-muted-foreground">{runningPlaces(running)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onShowRunning}>
            Ver no Histórico
          </Button>
        </div>
      ) : null}
      {ranked.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <h4 className="text-sm font-semibold text-muted-foreground">Leads novos por estado</h4>
          <ul>
            {ranked.map((row) => (
              <StateRankingRow
                key={row.state.code}
                row={row}
                topLeads={topLeads}
                open={openRow === row.state.code}
                onToggle={() => setOpenRow(openRow === row.state.code ? null : row.state.code)}
                onOpenState={() => onChoose(row.state.code)}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[15px] text-muted-foreground">
          Nenhuma busca no mapa ainda. Comece pela busca acima.
        </p>
      )}
    </div>
  );
}
