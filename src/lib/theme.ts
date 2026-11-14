import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The browser bar color per theme: the sidebar background (`--sidebar` in styles.css). */
export const THEME_COLOR: Record<Theme, string> = { light: "#f5f5f7", dark: "#1b1b1e" };

/**
 * The `theme-color` metas follow the system scheme until the app runs; then they follow the
 * theme on the page: the one picked in the app, else the system's.
 */
export function applyThemeColor(theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLOR[theme];
  }
}

/**
 * Runs before hydration to avoid a flash of the wrong theme: the theme picked in the app, else
 * the system's.
 */
export const THEME_INIT_SCRIPT = `(function(){var s=null;try{s=localStorage.getItem('${STORAGE_KEY}');}catch(e){}var d=s==='dark'||(s!=='light'&&window.matchMedia('${DARK_QUERY}').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';})();`;

const listeners = new Set<() => void>();
let systemQuery: MediaQueryList | null = null;

/** The theme picked in the app, or null when the user never picked one. */
function readSavedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    // Storage may be unavailable (private mode); then nothing was saved.
    return null;
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  for (const listener of listeners) listener();
}

/**
 * A theme picked by hand cross-fades (about 200 ms, see styles.css) instead of flashing the
 * whole page; instant for people who asked for less motion or browsers without the API.
 */
function applyThemeSmoothly(theme: Theme) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof document.startViewTransition !== "function") {
    applyTheme(theme);
    return;
  }
  document.startViewTransition(() => applyTheme(theme));
}

/** Without a saved pick, the page follows the system when it switches between light and dark. */
function followSystem(event: MediaQueryListEvent) {
  if (readSavedTheme()) return;
  applyTheme(event.matches ? "dark" : "light");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!systemQuery) {
    systemQuery = window.matchMedia(DARK_QUERY);
    systemQuery.addEventListener("change", followSystem);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && systemQuery) {
      systemQuery.removeEventListener("change", followSystem);
      systemQuery = null;
    }
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, (): Theme => "dark");
  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this page.
    }
    applyThemeSmoothly(next);
  }, []);
  return { theme, setTheme };
}
