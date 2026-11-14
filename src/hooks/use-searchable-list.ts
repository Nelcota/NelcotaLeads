import { useState, type KeyboardEvent } from "react";
import { filterByLabel, foldText } from "@/lib/text-match";

export type SearchOption = {
  /** `undefined` is the "all" row ("Todos os nichos"). */
  key: string | undefined;
  label: string;
  /** A second line under the label (a search's date). */
  sub?: string;
  /** Shown at the end of the row ("34 leads"). */
  count?: string;
};

type Options = {
  options: readonly SearchOption[];
  /** The "all" row's label; it shows only while nothing is typed. */
  allLabel: string;
  onPick: (key: string | undefined) => void;
  /** Esc on an empty field: leave the list. */
  onExit: () => void;
};

/** The typed text of a list with a search field, its matches and the field's keys. */
export function useSearchableList({ options, allLabel, onPick, onExit }: Options) {
  const [query, setQuery] = useState("");
  const folded = foldText(query.trim());
  const matches = filterByLabel(options, folded);
  const rows: SearchOption[] = folded ? matches : [{ key: undefined, label: allLabel }, ...matches];

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query) {
        setQuery("");
        return;
      }
      onExit();
      return;
    }
    if (event.key !== "Enter") return;
    const first = folded ? matches[0] : undefined;
    if (!first) return;
    event.preventDefault();
    onPick(first.key);
  };

  return {
    query,
    setQuery,
    clear: () => setQuery(""),
    /** Folded and trimmed, for marking the match. */
    folded,
    rows,
    matchCount: matches.length,
    onKeyDown,
  };
}
