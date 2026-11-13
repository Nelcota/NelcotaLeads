import type { BrazilState } from "@/lib/brazil-states";
import { STATE_OUTLINES } from "@/lib/brazil-outlines";
import { pluralize } from "@/lib/format";
import type { StateStats } from "@/lib/search-map";
import { cn } from "cn";

const FILL_CHOSEN = "color-mix(in srgb, var(--primary) 42%, var(--card))";
const FILL_SEARCHED = "color-mix(in srgb, var(--primary) 18%, var(--card))";
const FILL_EMPTY = "var(--fill-2)";

function fillOf(chosen: boolean, searched: boolean): string {
  if (chosen) return FILL_CHOSEN;
  return searched ? FILL_SEARCHED : FILL_EMPTY;
}

/** One state on the map: tinted by its searches, outlined when chosen, its numbers on hover. */
export function StateShape({
  state,
  stats,
  chosen,
  onClick,
}: {
  state: BrazilState;
  stats: StateStats | undefined;
  chosen: boolean;
  onClick: () => void;
}) {
  const fill = fillOf(chosen, stats !== undefined);
  const searches = pluralize(stats?.searches ?? 0, "busca", "buscas");
  const leads = pluralize(stats?.newLeads ?? 0, "lead novo", "leads novos");

  return (
    <path
      d={STATE_OUTLINES[state.code]}
      fill={fill}
      stroke={chosen ? "var(--foreground)" : "var(--card)"}
      strokeWidth={chosen ? 2 : 1}
      className={cn(
        "cursor-pointer transition-[fill] duration-200",
        !chosen && "hover:fill-[color-mix(in_srgb,var(--primary)_28%,var(--card))]",
      )}
      onClick={onClick}
    >
      <title>{`${state.name}: ${searches}, ${leads}`}</title>
    </path>
  );
}
