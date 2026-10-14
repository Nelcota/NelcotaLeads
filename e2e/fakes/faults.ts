/**
 * Failures the E2E control route arms and the fakes consume. Most are one-shot; `mailbox` (the
 * mail server refuses every connection) lasts until the test recovers it.
 */
export type E2eFault = "places" | "writeEmail" | "mailSend" | "mailbox";

declare global {
  // oxlint-disable-next-line no-var -- a global shared by the fakes and the E2E control route
  var nelcotaE2eFaults: Set<E2eFault> | undefined;
}

/** True once after the fault was armed; the next call works again. */
export function takeFault(fault: E2eFault): boolean {
  return globalThis.nelcotaE2eFaults?.delete(fault) ?? false;
}

/** True while the fault is armed, without consuming it. */
export function hasFault(fault: E2eFault): boolean {
  return globalThis.nelcotaE2eFaults?.has(fault) ?? false;
}
