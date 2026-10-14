import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ReportContext = createContext<(dirty: boolean) => void>(() => {});

/** Wraps what the guard watches; its value is the guard's `report`. */
export const UnsavedEditsScope = ReportContext.Provider;

/** Tells the surrounding guard that this component holds edits no one saved yet. */
export function useReportUnsavedEdits(dirty: boolean) {
  const report = useContext(ReportContext);
  useEffect(() => {
    report(dirty);
    return () => report(false);
  }, [dirty, report]);
}

/**
 * For text with no server draft behind it: `guard(action)` runs the action (close, next lead)
 * right away, or first asks "Descartar alterações?" when something inside reported unsaved
 * edits. Keeping on editing is the default answer.
 */
export function useUnsavedEditsGuard(
  description = "A mensagem que você editou ainda não foi salva.",
) {
  const dirty = useRef(false);
  const [pending, setPending] = useState<{ action: () => void } | null>(null);
  const report = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const guard = useCallback((action: () => void) => {
    if (dirty.current) setPending({ action });
    else action();
  }, []);

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              dirty.current = false;
              pending?.action();
            }}
          >
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guard, report, dialog };
}
