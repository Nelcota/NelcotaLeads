import { useEffect, useRef } from "react";
import { isTypingTarget } from "@/lib/shortcuts";

type LeadsHotkeys = {
  /** "/": focus the search. */
  onSearch: () => void;
  /** X, E, W on the row that has keyboard focus. */
  onToggle: (id: string) => void;
  onWriteEmail: (id: string) => void;
  onWhatsApp: (id: string) => void;
};

/** The lead id of the table row (or anything inside it) that has focus. */
function focusedLeadId(): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  return active.closest<HTMLElement>("[data-lead-id]")?.dataset.leadId ?? null;
}

/**
 * The list's keys: "/" anywhere on the page ("?" stays the app's help), X/E/W on the focused row. Off while the
 * user types and with a modifier held (the browser's own shortcuts stay untouched).
 */
export function useLeadsHotkeys(enabled: boolean, handlers: LeadsHotkeys) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        latest.current.onSearch();
        return;
      }
      const id = focusedLeadId();
      if (!id) return;
      const key = event.key.toLowerCase();
      const action =
        key === "x"
          ? latest.current.onToggle
          : key === "e"
            ? latest.current.onWriteEmail
            : key === "w"
              ? latest.current.onWhatsApp
              : undefined;
      if (!action) return;
      event.preventDefault();
      action(id);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
