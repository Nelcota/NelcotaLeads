import { optionId } from "@/hooks/use-state-picker";
import type { BrazilState, StateCode } from "@/lib/brazil-states";
import { pluralize } from "@/lib/format";
import type { StateStats } from "@/lib/search-map";
import type { StateGroup } from "@/lib/state-match";
import { cn } from "cn";

/**
 * The listbox of "Ir para um estado": states by region, each with its code and how many
 * searches it had. Mouse down picks without taking the focus from the text field.
 */
export function StatePickerOptions({
  listId,
  groups,
  text,
  active,
  stats,
  onPick,
  onHover,
}: {
  listId: string;
  groups: readonly StateGroup[];
  text: string;
  active: StateCode | undefined;
  stats: ReadonlyMap<StateCode, StateStats>;
  onPick: (code: StateCode) => void;
  onHover: (code: StateCode) => void;
}) {
  const info = (state: BrazilState) => {
    const searches = stats.get(state.code)?.searches ?? 0;
    if (searches === 0) return state.code;
    return `${state.code} · ${pluralize(searches, "busca", "buscas")}`;
  };

  return (
    <div id={listId} role="listbox" aria-label="Estados">
      {groups.length === 0 ? (
        <p className="px-2.5 py-3 text-sm text-muted-foreground">Nenhum estado com “{text}”</p>
      ) : null}
      {groups.map((group) => (
        <div
          key={group.name || "todos"}
          role="group"
          aria-label={group.name || "Estados"}
          className="border-border not-first:mt-1 not-first:border-t not-first:pt-1"
        >
          {group.name ? (
            <p aria-hidden className="px-2.5 pt-2 pb-1 text-xs font-semibold text-tertiary">
              {group.name}
            </p>
          ) : null}
          {group.states.map((state) => (
            <div
              key={state.code}
              id={optionId(listId, state.code)}
              role="option"
              aria-selected={state.code === active}
              className={cn(
                "flex min-h-10 cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 text-sm",
                state.code === active && "bg-fill-2",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(state.code);
              }}
              onMouseEnter={() => onHover(state.code)}
            >
              <span>{state.name}</span>
              <span className="text-xs whitespace-nowrap text-tertiary">{info(state)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
