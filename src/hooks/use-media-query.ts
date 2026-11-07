import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept in sync with resizes. `serverValue` is what the
 * first render (on the server and while hydrating) assumes.
 */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
