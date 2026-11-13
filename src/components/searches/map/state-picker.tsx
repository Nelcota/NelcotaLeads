import { SearchIcon, XIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { optionId, StatePickerOptions } from "@/components/searches/map/state-picker-options";
import type { StateCode } from "@/lib/brazil-states";
import { matchStates, type StateStats } from "@/lib/search-map";

/**
 * "Ir para um estado": a text field that finds a state by name or code (accents ignored) and
 * lists them by region while empty. Arrows move, Enter picks, Esc closes and then clears.
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
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const groups = matchStates(text);
  const options = groups.flatMap((group) => group.states.map((state) => state.code));
  const index = Math.min(activeIndex, Math.max(options.length - 1, 0));
  const active = open ? options[index] : undefined;

  // Keeps the active option in view while the arrows move through a long list.
  useEffect(() => {
    if (!active) return;
    document.getElementById(optionId(listId, active))?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const pick = (code: StateCode) => {
    setText("");
    setOpen(false);
    setActiveIndex(0);
    onPick(code);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const total = Math.max(options.length, 1);
      setActiveIndex(open ? (index + step + total) % total : 0);
      setOpen(true);
      return;
    }
    if (event.key === "Enter") {
      if (event.nativeEvent.isComposing || !open || !active) return;
      event.preventDefault();
      pick(active);
      return;
    }
    if (event.key === "Escape" && !open) setText("");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
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
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={active ? optionId(listId, active) : undefined}
            placeholder="Ir para um estado"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="h-10 w-full rounded-full border border-border bg-transparent pr-9 pl-9 text-base outline-none placeholder:text-sm placeholder:text-tertiary hover:border-tertiary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
          {text ? (
            <button
              type="button"
              aria-label="Limpar busca"
              className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-fill-2 hover:text-foreground"
              onMouseDown={(event) => {
                event.preventDefault();
                setText("");
                setActiveIndex(0);
                setOpen(true);
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
            if (anchor.current?.contains(event.target as Node)) event.preventDefault();
          }}
          className="z-50 max-h-[340px] w-(--radix-popover-trigger-width) min-w-60 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground [scrollbar-color:var(--text-tertiary)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1"
        >
          <StatePickerOptions
            listId={listId}
            groups={groups}
            text={text}
            active={active}
            stats={stats}
            onPick={pick}
            onHover={(code) => setActiveIndex(options.indexOf(code))}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
