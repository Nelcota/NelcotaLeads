/**
 * The signed-in person's id inside a server function, or null. The request helpers are loaded
 * on demand: they only exist while serving a request, and the modules the worker tests import
 * (leads, mail) must not pull them in.
 */
export async function requestUserId(): Promise<string | null> {
  const { currentUserId } = await import("./session-user.server");
  return currentUserId();
}

/** The app's origin as the current request reached it (for links sent by e-mail). */
export async function requestOrigin(): Promise<string> {
  const { currentOrigin } = await import("./session-user.server");
  return currentOrigin();
}
