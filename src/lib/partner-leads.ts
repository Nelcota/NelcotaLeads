/** The facts "Em andamento" orders by. */
type InProgressFacts = {
  status: string;
  followUpOn: string | null;
};

/** The leads a partner is working: the same ones "Leads ativos" counts. */
const WORKED = new Set(["contacted", "replied"]);

/** Overdue follow-ups first, then today's, then conversations, then the rest. */
function urgency(lead: InProgressFacts, today: string): number {
  if (lead.followUpOn && lead.followUpOn < today) return 0;
  if (lead.followUpOn === today) return 1;
  if (lead.status === "replied") return 2;
  return 3;
}

/**
 * "Em andamento" in a partner's profile: contacted and replied leads (what "Ver os N leads"
 * counts), the most urgent first, the first `shown`. Rows keep the list's order within a rank.
 */
export function leadsInProgress<T extends InProgressFacts>(
  rows: readonly T[],
  today: string,
  shown: number,
): T[] {
  return rows
    .filter((lead) => WORKED.has(lead.status))
    .map((lead, index) => ({ lead, index, rank: urgency(lead, today) }))
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, shown)
    .map((entry) => entry.lead);
}
