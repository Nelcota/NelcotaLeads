import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** Runs before hydration to avoid a flash of the wrong theme. Dark unless the user picked light. */
export const THEME_INIT_SCRIPT = `(function(){var d=true;try{d=localStorage.getItem('${STORAGE_KEY}')!=='light';}catch(e){}document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';})();`;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, (): Theme => "dark");
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this page.
    }
    for (const listener of listeners) listener();
  }, []);
  return { theme, setTheme };
}
