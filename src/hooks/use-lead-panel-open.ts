import { useEffect, useState } from "react";

const STORAGE_KEY = "conversas:lead-panel-open";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    // Private mode or blocked storage: the panel simply starts open.
    return true;
  }
}

function writeStored(open: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // Nothing to keep; the choice still holds while the page is open.
  }
}

/**
 * Whether the lead panel beside a conversation is shown. The choice holds across conversations
 * and is remembered on this device; it starts open.
 */
export function useLeadPanelOpen() {
  const [open, setOpen] = useState(true);

  // Read after mounting: the server render has no storage, so both start open.
  useEffect(() => {
    setOpen(readStored());
  }, []);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      writeStored(next);
      return next;
    });
  };

  return { open, toggle };
}
