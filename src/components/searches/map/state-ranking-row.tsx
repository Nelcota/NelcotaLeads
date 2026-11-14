import { ArrowRightIcon, ChevronDownIcon } from "@/components/icons";
import { useId } from "react";
import { RunningSearches } from "@/components/searches/map/running-searches";
import { Button } from "@/components/ui/button";
import { formatCount, pluralize } from "@/lib/format";
import type { RankedState } from "@/lib/search-map";

/**
 * One state in "Leads novos por estado": name, a bar against the top state, its numbers. It
 * opens (slowly, see .map-drawer) to the searches running there and a way into the state.
 */
export function StateRankingRow({
  row,
  topLeads,
  open,
  onToggle,
  onOpenState,
}: {
  row: RankedState;
  topLeads: number;
  open: boolean;
  onToggle: () => void;
  onOpenState: () => void;
}) {
  const panelId = useId();
  const { state, stats } = row;
  const searching = stats.running.length > 0;
  const width = Math.max(4, Math.round((stats.newLeads / Math.max(topLeads, 1)) * 100));

  return (
    <li className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="group grid min-h-12 w-full grid-cols-[minmax(0,1fr)_72px_64px_16px] items-center gap-3.5 text-left @lg:grid-cols-[minmax(0,1fr)_120px_92px_16px]"
      >
        <span className="flex flex-wrap items-center gap-2.5 text-[15px] font-semibold group-hover:underline group-hover:underline-offset-4">
          {state.name}
          {searching ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue">
              <i aria-hidden className="map-legend-route" />
              buscando
            </span>
          ) : null}
        </span>
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-fill-2">
          <i className="block h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
        </span>
        <span className="flex flex-col items-end text-xs text-muted-foreground">
          <b className="text-base font-semibold text-foreground tabular-nums">
            {formatCount(stats.newLeads)}
          </b>
          {pluralize(stats.searches, "busca", "buscas")}
        </span>
        <ChevronDownIcon
          aria-hidden
          className="size-4 text-muted-foreground transition-[rotate] duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-aria-expanded:rotate-180 motion-reduce:transition-none"
        />
      </button>
      <div id={panelId} className="map-drawer" data-open={open}>
        <div className="map-drawer-body">
          {searching ? (
            <RunningSearches searches={stats.running} />
          ) : (
            <p className="py-1 text-sm text-muted-foreground">
              Nenhuma busca rodando em {state.name} agora.
            </p>
          )}
          <Button variant="ghost" size="sm" className="-ml-3 mb-3 self-start" onClick={onOpenState}>
            Ver tudo de {state.name}
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </li>
  );
}
