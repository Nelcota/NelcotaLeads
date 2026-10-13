import { useBlocker } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
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

const ReportContext = createContext<(form: string, dirty: boolean) => void>(() => {});

/** Tells the page's LeaveGuard whether this form holds changes no one saved yet. */
export function useReportDirtyForm(form: string, dirty: boolean) {
  const report = useContext(ReportContext);
  useEffect(() => {
    report(form, dirty);
    return () => report(form, false);
  }, [form, dirty, report]);
}

/**
 * Wraps a page with forms: leaving it (another screen, back, reload or closing the tab) while
 * any form inside reported unsaved changes first asks "Descartar alterações?". Keeping on
 * editing is the default answer. Moving within the page (a #hash) never asks.
 */
export function LeaveGuard({ children }: { children: ReactNode }) {
  const dirty = useRef(new Set<string>());
  const report = useCallback((form: string, value: boolean) => {
    if (value) dirty.current.add(form);
    else dirty.current.delete(form);
  }, []);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty.current.size > 0 && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirty.current.size > 0,
    withResolver: true,
  });

  return (
    <ReportContext value={report}>
      {children}
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você mudou campos nesta tela e ainda não salvou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                dirty.current.clear();
                blocker.proceed?.();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReportContext>
  );
}
