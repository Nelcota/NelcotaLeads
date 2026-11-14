import { ChevronDownIcon, TagIcon } from "@/components/icons";
import { useState } from "react";
import { SearchableList } from "@/components/searchable-list";
import type { SearchOption } from "@/hooks/use-searchable-list";
import { cn } from "@/lib/utils";

const NOUN = { one: "nicho", many: "nichos", none: "nicho" } as const;

/**
 * "Nicho": opens in place under the button, pushing the list down (no layer over the page), with
 * a search field. Picking a niche closes it.
 */
export function NicheFilter({
  options,
  selected,
  onPick,
}: {
  options: readonly SearchOption[];
  selected: string | undefined;
  onPick: (key: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const value =
    options.find((item) => item.key === selected)?.label ?? selected ?? "Todos os nichos";

  const pick = (key: string | undefined) => {
    onPick(key);
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border transition-colors duration-200 hover:border-muted-foreground",
        open && "border-muted-foreground",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="conversas-niche"
        aria-label={`Nicho: ${value}`}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full items-center gap-2.5 px-3 text-left pointer-coarse:min-h-11 text-base transition-colors hover:bg-fill-2 active:bg-fill"
      >
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <TagIcon aria-hidden className="size-4" />
          Nicho
        </span>
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id="conversas-niche"
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          className={cn(
            "min-h-0 overflow-hidden transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="border-t border-border p-2">
            <SearchableList
              label="Nicho"
              placeholder="Buscar nicho"
              allLabel="Todos os nichos"
              noun={NOUN}
              options={options}
              selected={selected}
              onPick={pick}
              onExit={() => setOpen(false)}
              active={open}
              className="max-h-72"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
