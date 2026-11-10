import { createIsomorphicFn } from "@tanstack/react-start";

/** The cookie the sidebar writes when it is collapsed or expanded (components/ui/sidebar). */
export const SIDEBAR_COOKIE = "sidebar_state";

/** "false" means collapsed; anything else (or nothing) keeps the menu open. */
export function sidebarOpenFrom(value: string | undefined): boolean {
  return value !== "false";
}

/** One cookie's value out of a `document.cookie` string. */
export function cookieValue(cookies: string, name: string): string | undefined {
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

/**
 * Whether the sidebar starts open, read from its cookie on the server (so the first paint
 * already matches) and from `document.cookie` on client navigations. The server helpers load
 * on demand, inside `.server()`, so they never reach the browser bundle.
 */
export const readSidebarOpen = createIsomorphicFn()
  .server(async () => {
    try {
      const { getCookie } = await import("@tanstack/react-start/server");
      return sidebarOpenFrom(getCookie(SIDEBAR_COOKIE));
    } catch (error) {
      // A menu preference never takes a page down: it opens expanded instead.
      console.warn("sidebar_state could not be read", error);
      return true;
    }
  })
  .client(async () => sidebarOpenFrom(cookieValue(document.cookie, SIDEBAR_COOKIE)));
