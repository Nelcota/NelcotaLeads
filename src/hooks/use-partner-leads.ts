import { useQuery } from "@tanstack/react-query";
import { partnerLeadsQuery } from "@/lib/queries";

/**
 * "Em andamento" in a partner's profile: the contacted and replied leads that "Ver os N leads"
 * counts, overdue follow-ups first, ranked on the server. `now` is the list's own clock, so
 * "há 2 h" counts from when it was fetched, like the other lists.
 */
export function usePartnerLeads(memberId: string) {
  const { data, isError, dataUpdatedAt } = useQuery(partnerLeadsQuery(memberId));
  return {
    rows: data ?? null,
    failed: isError,
    now: new Date(dataUpdatedAt),
  };
}
