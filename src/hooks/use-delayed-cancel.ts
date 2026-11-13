import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { useCancelSearch } from "@/hooks/use-search-actions";

/** How long "Desfazer" stays possible before the search really stops. */
export const CANCEL_DELAY_MS = 5000;

type Pending = { timer: ReturnType<typeof setTimeout>; toastId: string | number };

/** Stops the wait and its toast; true when there was one. */
function release(pending: RefObject<Pending | null>): boolean {
  const current = pending.current;
  if (!current) return false;
  clearTimeout(current.timer);
  toast.dismiss(current.toastId);
  pending.current = null;
  return true;
}

/**
 * "Cancelar" with a way back: the search stops only after a few seconds, while a toast (and the
 * row itself) offer "Desfazer". Leaving the page before that stops it right away, so a cancel
 * the user asked for is never lost; a search that ends on its own drops the wait.
 */
export function useDelayedCancel(searchId: string, running: boolean) {
  const cancel = useCancelSearch();
  const pending = useRef<Pending | null>(null);
  const [waiting, setWaiting] = useState(false);
  // The latest mutate, for the timer and the unmount cleanup.
  const mutate = useRef(cancel.mutate);
  useEffect(() => {
    mutate.current = cancel.mutate;
  });

  const undo = () => {
    if (release(pending)) setWaiting(false);
  };

  const request = () => {
    if (pending.current) return;
    const toastId = toast("Cancelando a busca", {
      description: "Ela para em 5 segundos. O que já foi coletado continua nos leads.",
      duration: CANCEL_DELAY_MS,
      action: { label: "Desfazer", onClick: undo },
    });
    const timer = setTimeout(() => {
      pending.current = null;
      setWaiting(false);
      mutate.current(searchId);
    }, CANCEL_DELAY_MS);
    pending.current = { timer, toastId };
    setWaiting(true);
  };

  useEffect(() => {
    if (running) return;
    if (release(pending)) setWaiting(false);
  }, [running]);

  useEffect(
    () => () => {
      if (release(pending)) mutate.current(searchId);
    },
    [searchId],
  );

  return { request, undo, waiting, stopping: cancel.isPending };
}
