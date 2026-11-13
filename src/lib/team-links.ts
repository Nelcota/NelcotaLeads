import { localDay } from "./format";
import { NO_OWNER } from "./schemas";

/**
 * Where each number on the Equipe page leads, already filtered by that partner. Every target is
 * an existing screen; `owner` is the filter Leads and Conversas show as a removable chip.
 */
export const teamLinks = {
  held: (owner: string) => ({ to: "/leads", search: { view: "all", owner } }) as const,
  talking: (owner: string) => ({ to: "/leads", search: { view: "talking", owner } }) as const,
  proposals: (owner: string) =>
    ({ to: "/leads", search: { view: "talking", stage: "proposal", owner } }) as const,
  won: (owner: string) => ({ to: "/leads", search: { view: "closed", owner } }) as const,
  // "Retornar hoje" lists overdue follow-ups first, so due and late open the same queue.
  followUps: (owner: string) => ({ to: "/leads", search: { view: "followup", owner } }) as const,
  waiting: (owner: string) =>
    ({ to: "/conversas", search: { filter: "needsYou", owner } }) as const,
  meetings: (owner: string) => ({ to: "/agenda", search: { owner, view: "semana" } }) as const,
  meetingDay: (owner: string, startsAt: Date) =>
    ({ to: "/agenda", search: { owner, view: "dia", date: localDay(startsAt) } }) as const,
  free: () => ({ to: "/leads", search: { view: "all", owner: NO_OWNER } }) as const,
  lead: (lead: string) => ({ to: "/leads", search: { view: "all", lead } }) as const,
};

/** Any of the links above. */
export type TeamLink = ReturnType<(typeof teamLinks)[keyof typeof teamLinks]>;
