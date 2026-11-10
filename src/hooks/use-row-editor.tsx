import { useCallback, useRef, useState } from "react";
import { DiscardChangesDialog } from "@/components/leave-guard";

/**
 * Which row of a table is being edited (an id, "new", or none), guarding the open form:
 * opening another row while the current form holds unsaved changes first asks
 * "Descartar alterações?". The form reports its state through `reportDirty`.
 */
export function useRowEditor() {
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const dirty = useRef(false);

  const reportDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  const switchTo = (next: string | null) => {
    dirty.current = false;
    setEditing(next);
  };

  /** Opens `next` (or closes, with null) unless the open form would lose changes. */
  const open = (next: string | null) => {
    if (next === editing) return;
    if (editing !== null && dirty.current) {
      setPending(next);
      return;
    }
    switchTo(next);
  };

  const dialog = (
    <DiscardChangesDialog
      open={pending !== undefined}
      description="A linha que você está editando ainda não foi salva."
      onCancel={() => setPending(undefined)}
      onDiscard={() => {
        switchTo(pending ?? null);
        setPending(undefined);
      }}
    />
  );

  return {
    editing,
    open,
    /** Closes the form after a save or a cancel: nothing left to protect. */
    close: () => switchTo(null),
    reportDirty,
    dialog,
  };
}
