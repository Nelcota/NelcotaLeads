import { toast } from "sonner";

export const DEFAULT_ERROR = "Algo deu errado. Tente de novo.";

// Signs of a message written for developers (browser, runtime, database, validation dump),
// which must never reach the screen.
const TECHNICAL =
  /fetch|network|load failed|unexpected|sqlite|d1_|typeerror|referenceerror|syntaxerror|undefined|\bnull\b|json|stack|status code|internal|https?:|[{}[\]<>`]/i;

/**
 * The error's own message when it is one the server wrote for the user (a short sentence in
 * Portuguese), else null. Browser and runtime errors fall back to a fixed text.
 */
export function friendlyMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message || message.length > 240 || TECHNICAL.test(message)) return null;
  return /^[A-ZÀ-Ý]/.test(message) ? message : null;
}

/**
 * `onError` for a mutation: a toast with the server's message, or the given fallback. An `id`
 * makes repeated failures (e.g. autosave) replace one toast instead of stacking.
 */
export function errorToast(fallback = DEFAULT_ERROR, options: { id?: string } = {}) {
  return (error: unknown) => {
    toast.error(friendlyMessage(error) ?? fallback, options);
  };
}
