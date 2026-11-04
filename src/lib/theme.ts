import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** The browser bar color per theme: the sidebar background (`--sidebar` in styles.css). */
export const THEME_COLOR: Record<Theme, string> = { light: "#f5f5f7", dark: "#1b1b1e" };

/**
 * The `theme-color` metas follow the system scheme until the app runs; then they follow the
 * theme picked in the app, which defaults to dark whatever the system says.
 */
export function applyThemeColor(theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLOR[theme];
  }
}

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
