import { CheckIcon, SearchIcon, XIcon } from "@/components/icons";
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useSearchableList, type SearchOption } from "@/hooks/use-searchable-list";
import { matchParts } from "@/lib/text-match";
import { cn } from "@/lib/utils";

type SearchableListProps = {
  /** Names the radio group ("Nicho"). */
  label: string;
  placeholder: string;
  /** "nicho" → "3 nichos encontrados" and "Nenhum nicho com …". */
  noun: { one: string; many: string; none: string };
  options: readonly SearchOption[];
  allLabel: string;
  selected: string | undefined;
  onPick: (key: string | undefined) => void;
  onExit: () => void;
  /** Focuses the field when it turns true, without scrolling the page. */
  active: boolean;
  className?: string;
};

/** A search field over a one-of-many list: typed text marked in bold, Enter picks the first. */
export function SearchableList(props: SearchableListProps) {
  const list = useSearchableList(props);
  const field = useRef<HTMLInputElement>(null);
  const { active, noun } = props;

  useEffect(() => {
    // The list that holds the field turns visible at once when it opens, so it can take focus now.
    if (!active) return;
    field.current?.focus({ preventScroll: true });
  }, [active]);

  const countLabel = `${list.matchCount} ${list.matchCount === 1 ? `${noun.one} encontrado` : `${noun.many} encontrados`}`;

  return (
    <div className={cn("flex min-h-0 flex-col gap-1", props.className)}>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tertiary"
        />
        <Input
          ref={field}
          type="search"
          value={list.query}
          onChange={(event) => list.setQuery(event.target.value)}
          onKeyDown={list.onKeyDown}
          aria-label={props.placeholder}
          placeholder={props.placeholder}
          autoComplete="off"
          className="pr-10 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
        />
        {list.query ? (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={list.clear}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-fill-2 hover:text-foreground"
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {list.folded ? countLabel : ""}
      </p>
      <div
        role="radiogroup"
        aria-label={props.label}
        className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 [scrollbar-width:thin]"
      >
        {list.rows.map((option, index) => (
          <OptionRow
            key={option.key ?? "all"}
            option={option}
            query={list.folded}
            selected={option.key === props.selected}
            firstHit={Boolean(list.folded) && index === 0}
            onPick={props.onPick}
          />
        ))}
      </div>
      {list.folded && list.matchCount === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">
          {`Nenhum ${noun.none} com “${list.query.trim()}”.`}
        </p>
      ) : null}
    </div>
  );
}

function OptionRow({
  option,
  query,
  selected,
  firstHit,
  onPick,
}: {
  option: SearchOption;
  query: string;
  selected: boolean;
  firstHit: boolean;
  onPick: (key: string | undefined) => void;
}) {
  const parts = matchParts(option.label, query);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onPick(option.key)}
      className={cn(
        "flex min-h-10 w-full items-center gap-3 rounded-lg pointer-coarse:min-h-11 px-2 py-1.5 text-left text-base transition-colors hover:bg-fill-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground active:bg-fill",
        selected && "font-semibold",
        firstHit && "bg-fill-2",
      )}
    >
      <span className="w-4 flex-none text-blue">
        {selected ? <CheckIcon aria-hidden className="size-4" /> : null}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate leading-tight">
          {parts.before}
          {parts.match ? <strong className="font-bold">{parts.match}</strong> : null}
          {parts.after}
        </span>
        {option.sub ? (
          <span className="text-[13px] leading-tight font-normal text-tertiary">{option.sub}</span>
        ) : null}
      </span>
      {option.count ? (
        <span className="text-[13px] font-normal whitespace-nowrap text-tertiary tabular-nums">
          {option.count}
        </span>
      ) : null}
    </button>
  );
}
