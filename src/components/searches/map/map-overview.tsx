import { useState } from "react";
import { MapNumbers } from "@/components/searches/map/map-numbers";
import { StatePicker } from "@/components/searches/map/state-picker";
import { StateRankingRow } from "@/components/searches/map/state-ranking-row";
import { Button } from "@/components/ui/button";
import type { StateCode } from "@/lib/brazil-states";
import { formatCount, pluralize } from "@/lib/format";
import { runningPlaces, type BrazilSummary } from "@/lib/search-map";

/**
 * The panel next to the map with no state chosen: Brasil's numbers, what runs now, and the
 * states ranked by new leads; a row opens to its running searches.
 */
export function MapOverview({
  summary,
  onChoose,
  onShowRunning,
}: {
  summary: BrazilSummary;
  onChoose: (code: StateCode) => void;
  onShowRunning: () => void;
}) {
  const [openRow, setOpenRow] = useState<StateCode | null>(null);
  const { stats, ranked, running, unplaced, topLeads } = summary;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-xl font-semibold">Brasil</h3>
        <StatePicker stats={stats} onPick={onChoose} />
      </div>
      <MapNumbers
        numbers={[
          { label: "Buscas", value: formatCount(summary.searches) },
          { label: "Leads novos", value: formatCount(summary.newLeads) },
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
              {pluralize(running.length, "busca", "buscas")} em andamento
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
          Nenhuma busca com estado conhecido ainda.
        </p>
      )}
      {unplaced > 0 ? (
        <p className="text-xs text-muted-foreground">
          {pluralize(
            unplaced,
            "busca sem estado conhecido fica",
            "buscas sem estado conhecido ficam",
          )}{" "}
          só no Histórico: a cidade digitada não diz o estado e não há leads com endereço.
        </p>
      ) : null}
    </div>
  );
}
