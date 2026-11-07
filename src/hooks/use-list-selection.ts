import { useState } from "react";

const NO_SELECTION: ReadonlySet<string> = new Set();

/**
 * A selection that belongs to one list: when `listKey` changes (another tab, filter, search or
 * order) it starts over empty. `selectFor` selects ids for a list about to be shown.
 */
export function useListSelection(listKey: string) {
  const [selection, setSelection] = useState({ key: listKey, ids: NO_SELECTION });
  const selected = selection.key === listKey ? selection.ids : NO_SELECTION;

  const update = (change: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
    setSelection((current) => ({
      key: listKey,
      ids: change(current.key === listKey ? current.ids : NO_SELECTION),
    }));

  const toggle = (ids: string[], on: boolean) =>
    update((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) {
          next.add(id);
          continue;
        }
        next.delete(id);
      }
      return next;
    });

  return {
    selected,
    toggle,
    clear: () => update(() => NO_SELECTION),
    replace: (ids: string[]) => update(() => new Set(ids)),
  };
}
