import { MapLabels } from "@/components/searches/map/map-labels";
import { StateRoutes } from "@/components/searches/map/state-routes";
import { StateShape } from "@/components/searches/map/state-shape";
import { BRAZIL_STATES, type StateCode } from "@/lib/brazil-states";
import { MAP_HEIGHT, MAP_WIDTH } from "@/lib/brazil-outlines";
import { stateLabel } from "@/lib/map-geometry";
import type { StateStats } from "@/lib/search-map";

/**
 * Brazil by state: tinted where there were searches, stronger on the chosen one, with routes
 * inside each state being searched. Mouse only; the state picker and the ranking next to it
 * give the same choice by keyboard and screen reader.
 */
export function BrazilMap({
  stats,
  chosen,
  onChoose,
}: {
  stats: ReadonlyMap<StateCode, StateStats>;
  chosen: StateCode | undefined;
  onChoose: (code: StateCode | undefined) => void;
}) {
  // The chosen state is drawn last, so its neighbors' borders never cover its outline.
  const drawOrder = BRAZIL_STATES.toSorted(
    (a, b) => Number(a.code === chosen) - Number(b.code === chosen),
  );
  const running = BRAZIL_STATES.filter((state) => (stats.get(state.code)?.running.length ?? 0) > 0);

  return (
    <div className="relative w-[calc(100%-28px)] max-w-[460px]">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        aria-hidden
        className="block h-auto w-full overflow-visible"
      >
        {drawOrder.map((state) => (
          <StateShape
            key={state.code}
            state={state}
            stats={stats.get(state.code)}
            chosen={state.code === chosen}
            onClick={() => onChoose(state.code === chosen ? undefined : state.code)}
          />
        ))}
        {BRAZIL_STATES.map((state) => {
          const guide = stateLabel(state.code).guide;
          if (!guide) return null;
          const [x1, y1, x2, y2] = guide;
          return (
            <line
              key={state.code}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="pointer-events-none stroke-tertiary"
            />
          );
        })}
        {running.map((state) => (
          <StateRoutes key={state.code} code={state.code} />
        ))}
      </svg>
      <MapLabels strong={(code) => code === chosen || stats.has(code)} />
    </div>
  );
}
