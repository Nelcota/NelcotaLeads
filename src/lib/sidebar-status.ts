/**
 * What the sidebar says about the system, decided in one place for the status dot on top and
 * the card at the bottom, so the two never disagree.
 */
export type SidebarStatus = "loading" | "unavailable" | "mail" | "system" | "ok";

export type SidebarStatusInput = {
  mail: { configured: boolean };
  systemAttention: boolean;
};

/** Short text for the account menu and screen readers; null while the status is loading. */
export const SIDEBAR_STATUS_LABEL: Record<SidebarStatus, string | null> = {
  loading: null,
  unavailable: "Situação indisponível",
  mail: "E-mail não conectado",
  system: "Algo precisa de atenção",
  ok: "Tudo funcionando",
};

/**
 * Data already loaded wins over a later failed refresh; a problem that stops the sending (no
 * mailbox) comes before a failing automatic task.
 */
export function sidebarStatus(
  data: SidebarStatusInput | undefined,
  failed: boolean,
): SidebarStatus {
  if (data) return statusOf(data);
  if (failed) return "unavailable";
  return "loading";
}

function statusOf(data: SidebarStatusInput): SidebarStatus {
  if (!data.mail.configured) return "mail";
  if (data.systemAttention) return "system";
  return "ok";
}

/** Whether the status asks the user to act (orange), as opposed to fine or unknown. */
export function statusNeedsAction(status: SidebarStatus): boolean {
  return status === "mail" || status === "system";
}
