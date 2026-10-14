import { useEffect } from "react";
import { toast } from "sonner";

/**
 * After a redirect from a link to something that no longer exists (`?missing=true`), says so
 * once and drops the flag from the URL, so a reload or Back doesn't say it again.
 */
export function useNotFoundToast(missing: boolean | undefined, message: string, clear: () => void) {
  useEffect(() => {
    if (!missing) return;
    toast.error(message, { id: "not-found" });
    clear();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per redirect, not per render
  }, [missing]);
}
