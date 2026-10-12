/** One-shot failures the E2E control route arms and the fakes consume. */
export type E2eFault = "places" | "writeEmail" | "mailSend";

declare global {
  // oxlint-disable-next-line no-var -- a global shared by the fakes and the E2E control route
  var nelcotaE2eFaults: Set<E2eFault> | undefined;
}

/** True once after the fault was armed; the next call works again. */
export function takeFault(fault: E2eFault): boolean {
  return globalThis.nelcotaE2eFaults?.delete(fault) ?? false;
}
