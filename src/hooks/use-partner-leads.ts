import { useQuery } from "@tanstack/react-query";
import { leadsInProgress } from "@/lib/partner-leads";
import { leadsQuery } from "@/lib/queries";

/** Leads the profile lists before "Ver os N leads". */
const SHOWN = 5;

/**
 * "Em andamento" in a partner's profile: the contacted and replied leads that "Ver os N leads"
 * counts, overdue follow-ups first. `now` is the list's own clock, so "há 2 h" counts from when
 * it was fetched, like the other lists.
 */
export function usePartnerLeads(memberId: string, today: string) {
  const { data, isError, dataUpdatedAt } = useQuery(leadsQuery({ owner: memberId, view: "all" }));
  return {
    rows: data ? leadsInProgress(data.rows, today, SHOWN) : null,
    failed: isError,
    now: new Date(dataUpdatedAt),
  };
}
