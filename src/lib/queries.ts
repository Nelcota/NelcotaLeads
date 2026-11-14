import { keepPreviousData, queryOptions, type QueryClient } from "@tanstack/react-query";
import type { OverviewPeriod } from "@/lib/period";
import { LEAD_NOT_FOUND, type LeadFilters } from "@/lib/schemas";
import { getAccount } from "@/server/account";
import { getAgenda, getTodayAgenda } from "@/server/agenda";
import { getAttentionCount, getAutopilot, getDashboard } from "@/server/dashboard";
import { getSendWindow } from "@/server/dispatch";
import { getMonthlyGoal } from "@/server/goals";
import { getColdRoom, getConversation, listConversations, listReusableDrafts } from "@/server/mail";
import { getLead, getLeadCounts, listLeads } from "@/server/leads";
import { getProviderStatus, listSearches } from "@/server/searches";
import { listNicheMetrics, listNiches } from "@/server/niches";
import { getOverviewMetrics } from "@/server/overview-metrics";
import { getNotifications } from "@/server/notifications";
import { listPartnerLeadsInProgress } from "@/server/partner-leads";
import { getBookableLeads, getLeadSales } from "@/server/sales";
import { getServiceTable } from "@/server/services";
import { getQuickReplies } from "@/server/settings";
import { getSystemStatus } from "@/server/system-status";
import { getTeam, listTeamMembers } from "@/server/team";

const isRunning = (status: string) => status === "collecting" || status === "analyzing";

export const searchesQuery = queryOptions({
  queryKey: ["searches"],
  queryFn: () => listSearches(),
  refetchInterval: (query) => (query.state.data?.some((s) => isRunning(s.status)) ? 3000 : false),
});

/** Niches with their funnel, for the filters and the overview. */
export const nichesQuery = queryOptions({
  queryKey: ["niches"],
  queryFn: () => listNiches(),
  refetchInterval: 60_000,
});

/** The signed-in account; it only changes on sign-in, so it is never refetched on its own. */
export const accountQuery = queryOptions({
  queryKey: ["account"],
  queryFn: () => getAccount(),
  staleTime: Infinity,
});

/**
 * Drafts already written for a dispatch review, read without asking the AI. Always fresh: the
 * review edits them locally and must not open on an old copy.
 */
export const reusableDraftsQuery = (leadIds: string[]) =>
  queryOptions({
    queryKey: ["dispatch-drafts", leadIds],
    queryFn: () => listReusableDrafts({ data: { leadIds } }),
    enabled: leadIds.length > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

/** Room left today for first e-mails: cold limit, sent today and cold e-mails queued. */
export const coldRoomQuery = queryOptions({
  queryKey: ["cold-room"],
  queryFn: () => getColdRoom(),
});

/** The automation settings (busca diária, IA responde sozinha, disparo automático): one read. */
export const autopilotQuery = queryOptions({
  queryKey: ["autopilot"],
  queryFn: () => getAutopilot(),
});

/** The hours first e-mails and follow-ups go out (Configurações → E-mail). */
export const sendWindowQuery = queryOptions({
  queryKey: ["send-window"],
  queryFn: () => getSendWindow(),
});

export const providerStatusQuery = queryOptions({
  queryKey: ["provider-status"],
  queryFn: () => getProviderStatus(),
});

export const leadsQuery = (filters: LeadFilters) =>
  queryOptions({
    queryKey: ["leads", filters],
    queryFn: () => listLeads({ data: filters }),
    // Keep refreshing while the queue is still analyzing some of the visible leads.
    refetchInterval: (query) =>
      query.state.data?.rows.some((lead) => lead.analysisStatus === "pending") ? 3000 : false,
    // While a search or filter change loads, the list keeps the last rows instead of flashing
    // "Nenhum lead" between keystrokes.
    placeholderData: keepPreviousData,
  });

/**
 * "Em andamento" in a partner's profile. Under "leads", so every change to a lead refreshes it
 * along with the Leads list.
 */
export const partnerLeadsQuery = (owner: string) =>
  queryOptions({
    queryKey: ["leads", "partner-in-progress", owner],
    queryFn: () => listPartnerLeadsInProgress({ data: { owner } }),
  });

export const leadQuery = (id: string) =>
  queryOptions({
    queryKey: ["lead", id],
    queryFn: () => getLead({ data: { id } }),
    // A missing lead stays missing: show it at once instead of retrying three times.
    retry: (failures, error) => error.message !== LEAD_NOT_FOUND && failures < 3,
    refetchInterval: (query) =>
      query.state.data?.lead.analysisStatus === "pending" ? 3000 : false,
  });

export const leadCountsQuery = (filters: LeadFilters) =>
  queryOptions({
    queryKey: ["leads", "counts", filters],
    queryFn: () => getLeadCounts({ data: filters }),
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 3000 : false),
    // The tab counts stay on screen while the next filter's counts load.
    placeholderData: keepPreviousData,
  });

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
  // Fast only while a search is collecting or analyzing. Queued e-mails go out a few per
  // minute (and some are always queued), so they only need the regular minute refresh.
  refetchInterval: (query) =>
    query.state.data?.activity.searches.some((search) => isRunning(search.status)) ? 5000 : 60_000,
});

export const attentionQuery = queryOptions({
  queryKey: ["conversations", "attention"],
  queryFn: () => getAttentionCount(),
  refetchInterval: 60_000,
});

export const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: () => listConversations(),
  refetchInterval: 30_000,
});

export const conversationQuery = (leadId: string) =>
  queryOptions({
    queryKey: ["conversations", leadId],
    queryFn: () => getConversation({ data: { leadId } }),
    refetchInterval: 15_000,
  });

/** "Respostas rápidas", edited in Configurações and inserted from the composer. */
export const quickRepliesQuery = queryOptions({
  queryKey: ["quick-replies"],
  queryFn: () => getQuickReplies(),
});

/** Conta → Status. Refreshed every minute, only while a screen that shows it is open. */
export const systemStatusQuery = queryOptions({
  queryKey: ["system-status"],
  queryFn: () => getSystemStatus(),
  refetchInterval: 60_000,
});

/** "Serviços e preços": what proposals are built from. */
export const serviceTableQuery = queryOptions({
  queryKey: ["service-table"],
  queryFn: () => getServiceTable(),
});

/** The lead's upcoming meetings and latest proposal, under ["lead", id] so it refreshes with it. */
export const leadSalesQuery = (leadId: string) =>
  queryOptions({
    queryKey: ["lead", leadId, "sales"],
    queryFn: () => getLeadSales({ data: { leadId } }),
  });

/** The Agenda from one day to another, for everyone (null) or one person of the team. */
export const agendaQuery = (owner: string | null, from: string, to: string) =>
  queryOptions({
    queryKey: ["agenda", owner, from, to],
    queryFn: () => getAgenda({ data: { owner, from, to } }),
    refetchInterval: 60_000,
    // While a new range loads, keep the last one on screen, but never another owner's agenda.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === owner ? previous : undefined,
  });

/** The leads "Marcar reunião" on the Agenda can pick from. */
export const bookableLeadsQuery = queryOptions({
  queryKey: ["leads", "bookable"],
  queryFn: () => getBookableLeads(),
});

/** Today's meetings and follow-ups: the sidebar badge and "Agenda de hoje". */
export const todayAgendaQuery = queryOptions({
  queryKey: ["agenda", "today"],
  queryFn: () => getTodayAgenda(),
  refetchInterval: 60_000,
});

/** "Meta do mês" on the Visão geral. */
export const monthlyGoalQuery = queryOptions({
  queryKey: ["monthly-goal"],
  queryFn: () => getMonthlyGoal(),
  refetchInterval: 60_000,
});

/** The Visão geral metrics of a period (?period=). */
export const overviewMetricsQuery = (period: OverviewPeriod) =>
  queryOptions({
    queryKey: ["overview-metrics", period],
    queryFn: () => getOverviewMetrics({ data: { period } }),
    refetchInterval: 60_000,
  });

/** "Por nicho" on the Visão geral, for a period. */
export const nicheMetricsQuery = (period: OverviewPeriod) =>
  queryOptions({
    queryKey: ["niches", "metrics", period],
    queryFn: () => listNicheMetrics({ data: { period } }),
    refetchInterval: 60_000,
  });

/** The bell: refreshed every 30 s, so a reply or a meeting about to start shows up quickly. */
export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () => getNotifications(),
  refetchInterval: 30_000,
  refetchIntervalInBackground: true,
});

/** "Equipe" for a period: partners and their numbers, goal, free leads, activity and invites. */
export const teamQuery = (period: OverviewPeriod) =>
  queryOptions({
    queryKey: ["team", period],
    queryFn: () => getTeam({ data: { period } }),
    refetchInterval: 60_000,
  });

/** Everyone's id and name: the owner chips in Leads and Conversas. */
export const teamMembersQuery = queryOptions({
  queryKey: ["team-members"],
  queryFn: () => listTeamMembers(),
  staleTime: 5 * 60_000,
});

/**
 * Every screen a lead's status, deal, meeting or proposal shows up on: the lists, the
 * Visão geral (goal, metrics, niches, all periods), the Agenda (and its today badge), the
 * Conversas (with its attention badge), the notification bell and the Equipe page. Prefix keys, so
 * the period- and owner-keyed ones match.
 */
export const LEAD_SCREEN_KEYS = [
  ["leads"],
  ["team"],
  ["dashboard"],
  ["agenda"],
  ["monthly-goal"],
  ["overview-metrics"],
  ["niches"],
  ["conversations"],
  ["notifications"],
] as const;

/** Refetches every screen in LEAD_SCREEN_KEYS after a lead changed. */
export function invalidateLeadScreens(queryClient: QueryClient) {
  return Promise.all(
    LEAD_SCREEN_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
