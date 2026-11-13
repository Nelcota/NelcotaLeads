import { useQuery } from "@tanstack/react-query";
import { leadsQuery } from "@/lib/queries";

/** Leads the profile lists before "Ver os N em Leads". */
const SHOWN = 5;

/**
 * "Em andamento" in a partner's profile: their leads in conversation, the first few. `now` is
 * the list's own clock, so "há 2 h" counts from when it was fetched, like the other lists.
 */
export function usePartnerLeads(memberId: string) {
  const { data, isError, dataUpdatedAt } = useQuery(
    leadsQuery({ owner: memberId, view: "talking" }),
  );
  return {
    rows: data ? data.rows.slice(0, SHOWN) : null,
    failed: isError,
    now: new Date(dataUpdatedAt),
  };
}
