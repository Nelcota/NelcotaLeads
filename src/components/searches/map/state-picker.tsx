import { SearchIcon, XIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useId, useRef } from "react";
import { StatePickerOptions } from "@/components/searches/map/state-picker-options";
import { optionId, useStatePicker } from "@/hooks/use-state-picker";
import type { StateCode } from "@/lib/brazil-states";
import type { StateStats } from "@/lib/search-map";

/**
 * "Ir para um estado": a text field that finds a state by name or code (accents ignored) and
 * lists them by region while empty. The list opens under the field without taking its focus.
 */
export function StatePicker({
  stats,
  onPick,
}: {
  stats: ReadonlyMap<StateCode, StateStats>;
  onPick: (code: StateCode) => void;
}) {
  const inputId = useId();
  const listId = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const picker = useStatePicker(listId, onPick);

  return (
    <PopoverPrimitive.Root open={picker.open} onOpenChange={picker.setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={anchor} className="relative w-full @lg:w-60">
          <label htmlFor={inputId} className="sr-only">
            Ir para um estado
          </label>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={picker.open}
            aria-controls={listId}
            aria-activedescendant={picker.active ? optionId(listId, picker.active) : undefined}
            placeholder="Ir para um estado"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            value={picker.text}
            onChange={(event) => picker.type(event.target.value)}
            onFocus={() => picker.setOpen(true)}
            onClick={() => picker.setOpen(true)}
            onKeyDown={picker.onKeyDown}
            className="h-10 w-full rounded-full border border-border bg-transparent pr-9 pl-9 text-base outline-none placeholder:text-sm placeholder:text-tertiary hover:border-tertiary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          {picker.text ? (
            <button
              type="button"
              aria-label="Limpar busca"
              className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-fill-2 hover:text-foreground"
              onMouseDown={(event) => {
                event.preventDefault();
                picker.type("");
              }}
            >
              <XIcon aria-hidden className="size-3.5" />
            </button>
          ) : null}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Node && anchor.current?.contains(target)) event.preventDefault();
          }}
          className="z-50 max-h-[340px] w-(--radix-popover-trigger-width) min-w-60 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground [scrollbar-color:var(--text-tertiary)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1"
        >
          <StatePickerOptions
            listId={listId}
            groups={picker.groups}
            text={picker.text}
            active={picker.active}
            stats={stats}
            onPick={picker.pick}
            onHover={picker.hover}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
