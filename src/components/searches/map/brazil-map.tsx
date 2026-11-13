import { MapLabels } from "@/components/searches/map/map-labels";
import { StateRoutes } from "@/components/searches/map/state-routes";
import { BRAZIL_STATES, type StateCode } from "@/lib/brazil-states";
import { MAP_HEIGHT, MAP_WIDTH, STATE_OUTLINES } from "@/lib/brazil-outlines";
import { stateLabel } from "@/lib/map-geometry";
import type { StateStats } from "@/lib/search-map";
import { cn } from "cn";

const FILL_CHOSEN = "color-mix(in srgb, var(--primary) 42%, var(--card))";
const FILL_SEARCHED = "color-mix(in srgb, var(--primary) 18%, var(--card))";
const FILL_EMPTY = "var(--fill-2)";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

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
  const running = BRAZIL_STATES.filter((state) => (stats.get(state.code)?.running.length ?? 0) > 0);
  const fillOf = (code: StateCode) => {
    if (code === chosen) return FILL_CHOSEN;
    return stats.has(code) ? FILL_SEARCHED : FILL_EMPTY;
  };

  return (
    <div className="relative w-[calc(100%-28px)] max-w-[460px]">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        aria-hidden
        className="block h-auto w-full overflow-visible"
      >
        {BRAZIL_STATES.map((state) => {
          const found = stats.get(state.code);
          return (
            <path
              key={state.code}
              d={STATE_OUTLINES[state.code]}
              fill={fillOf(state.code)}
              stroke={state.code === chosen ? "var(--foreground)" : "var(--card)"}
              strokeWidth={state.code === chosen ? 2 : 1}
              className={cn(
                "cursor-pointer transition-[fill] duration-200",
                state.code !== chosen &&
                  "hover:fill-[color-mix(in_srgb,var(--primary)_28%,var(--card))]",
              )}
              onClick={() => onChoose(state.code === chosen ? undefined : state.code)}
            >
              <title>
                {`${state.name}: ${plural(found?.searches ?? 0, "busca", "buscas")}, ${plural(found?.newLeads ?? 0, "lead novo", "leads novos")}`}
              </title>
            </path>
          );
        })}
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
