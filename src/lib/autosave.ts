import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

const DELAY_MS = 800;

/**
 * Saves edits shortly after the typing stops, one request at a time and never one per key.
 * Each key (e.g. a draft id) keeps only its latest value. What is still pending is saved right
 * away when the component unmounts, `flush` lets an action (send, close, rewrite) wait until
 * everything typed is stored, and `discard` drops a key's pending edit (e.g. a removed draft).
 */
export function useAutosave<T>(
  save: (key: string, value: T) => Promise<unknown>,
  onError?: (error: unknown) => void,
) {
  const saveRef = useRef(save);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    saveRef.current = save;
    onErrorRef.current = onError;
  });
  const pending = useRef(new Map<string, T>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const running = useRef(0);
  const [state, setState] = useState<AutosaveState>("idle");

  const settle = useCallback((result: "saved" | "error") => {
    if (pending.current.size === 0 && running.current === 0) setState(result);
  }, []);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const batch = [...pending.current];
    pending.current.clear();
    for (const [key, value] of batch) {
      running.current += 1;
      chain.current = chain.current.then(async () => {
        let result: "saved" | "error" = "saved";
        try {
          await saveRef.current(key, value);
        } catch (error) {
          result = "error";
          onErrorRef.current?.(error);
        }
        running.current -= 1;
        settle(result);
      });
    }
    return chain.current;
  }, [settle]);

  const schedule = useCallback(
    (key: string, value: T) => {
      pending.current.set(key, value);
      setState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), DELAY_MS);
    },
    [flush],
  );

  const discard = useCallback((key: string) => {
    pending.current.delete(key);
    if (pending.current.size === 0) {
      clearTimeout(timer.current);
      timer.current = undefined;
      if (running.current === 0) setState("idle");
    }
    return chain.current;
  }, []);

  // Leaving the screen saves what was typed instead of dropping it.
  useEffect(() => () => void flush(), [flush]);

  return useMemo(() => ({ state, schedule, flush, discard }), [state, schedule, flush, discard]);
}
