import { useEffect, useRef } from "react";
import { isTypingTarget } from "@/lib/shortcuts";

type ListHotkeys = {
  /** J. */
  onNext?: () => void;
  /** K. */
  onPrev?: () => void;
  /** Esc. */
  onEscape?: () => void;
};

/**
 * J/K (and optionally Esc) to move through a list while `enabled`. Off while the user types
 * (inputs, textareas, contenteditable) and with a modifier held, so it never eats a key.
 */
export function useListHotkeys(enabled: boolean, handlers: ListHotkeys) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const action =
        event.key === "j" || event.key === "J"
          ? latest.current.onNext
          : event.key === "k" || event.key === "K"
            ? latest.current.onPrev
            : event.key === "Escape"
              ? latest.current.onEscape
              : undefined;
      if (!action) return;
      event.preventDefault();
      action();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
