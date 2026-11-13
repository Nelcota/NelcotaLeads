import { STATE_CODES, type StateCode } from "@/lib/brazil-states";
import { MAP_HEIGHT, MAP_WIDTH } from "@/lib/brazil-outlines";
import { stateLabel } from "@/lib/map-geometry";
import { cn } from "cn";

const SIDE_SHIFT = {
  center: "-translate-x-1/2",
  right: "",
  left: "-translate-x-full",
} as const;

const percent = (value: number, of: number) => `${((value / of) * 100).toFixed(2)}%`;

/**
 * The state codes over the map, in HTML so they keep their size at any map width. A state with
 * searches, or the chosen one, gets the stronger color.
 */
export function MapLabels({ strong }: { strong: (code: StateCode) => boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {STATE_CODES.map((code) => {
        const label = stateLabel(code);
        return (
          <span
            key={code}
            className={cn(
              "absolute -translate-y-1/2 text-[10px] leading-none font-semibold tracking-wide",
              SIDE_SHIFT[label.side],
              strong(code) ? "text-foreground" : "text-muted-foreground",
            )}
            style={{ left: percent(label.x, MAP_WIDTH), top: percent(label.y, MAP_HEIGHT) }}
          >
            {code}
          </span>
        );
      })}
    </div>
  );
}
