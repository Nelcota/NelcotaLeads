type ViewLocation = { pathname: string; search: unknown };

/**
 * Whether going from one location to the next replaces what is on screen: another path, or
 * another search on the same path (a Configurações tab). A #hash alone stays on the view.
 */
export function leavesView(current: ViewLocation, next: ViewLocation): boolean {
  if (current.pathname !== next.pathname) return true;
  return JSON.stringify(current.search ?? {}) !== JSON.stringify(next.search ?? {});
}
