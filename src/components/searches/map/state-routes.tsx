import type { StateCode } from "@/lib/brazil-states";
import { STATE_OUTLINES } from "@/lib/brazil-outlines";
import { stateRoutes } from "@/lib/map-geometry";

/**
 * A state with a running search: dashed routes leave its center toward the borders, clipped
 * to the state so none leaves it.
 */
export function StateRoutes({ code }: { code: StateCode }) {
  const clipId = `map-clip-${code}`;
  return (
    <g aria-hidden>
      <clipPath id={clipId}>
        <path d={STATE_OUTLINES[code]} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {stateRoutes(code).map((route, index) => (
          <path
            key={route}
            d={route}
            className="map-route"
            style={{ animationDelay: `-${(index * 0.7).toFixed(1)}s` }}
          />
        ))}
      </g>
    </g>
  );
}
