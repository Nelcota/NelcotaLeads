import { queryOptions } from "@tanstack/react-query";
import type { LeadFilters } from "@/lib/schemas";
import { getAttentionCount, getDashboard } from "@/server/dashboard";
import { getConversation, listConversations } from "@/server/mail";
import { getLead, getLeadCounts, listLeads } from "@/server/leads";
import { getProviderStatus, getSearch, listSearches } from "@/server/searches";

const isRunning = (status: string) => status === "collecting" || status === "analyzing";

export const searchesQuery = queryOptions({
  queryKey: ["searches"],
  queryFn: () => listSearches(),
  refetchInterval: (query) => (query.state.data?.some((s) => isRunning(s.status)) ? 3000 : false),
});

export const searchQuery = (id: string) =>
  queryOptions({
    queryKey: ["searches", id],
    queryFn: () => getSearch({ data: { id } }),
    // Poll while the queue is still working on this search.
    refetchInterval: (query) =>
      query.state.data && isRunning(query.state.data.status) ? 2000 : false,
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
      query.state.data?.some((lead) => lead.analysisStatus === "pending") ? 3000 : false,
  });

export const leadQuery = (id: string) =>
  queryOptions({
    queryKey: ["lead", id],
    queryFn: () => getLead({ data: { id } }),
    refetchInterval: (query) =>
      query.state.data?.lead.analysisStatus === "pending" ? 3000 : false,
  });

export const leadCountsQuery = (filters: LeadFilters) =>
  queryOptions({
    queryKey: ["leads", "counts", filters],
    queryFn: () => getLeadCounts({ data: filters }),
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 3000 : false),
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
