/** Leads the profile lists before "Ver os N leads". */
export const PROFILE_LEADS_SHOWN = 5;

/** The facts "Em andamento" orders by. */
type InProgressFacts = {
  id: string;
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

/** Each lead once, at its first place (a lead due today is also in conversation). */
function uniqueById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * "Em andamento" in a partner's profile: contacted and replied leads (what "Ver os N leads"
 * counts), each once, the most urgent first, the first `shown`. Rows keep their order within a
 * rank, so the lists it is built from decide the order inside each group.
 */
export function leadsInProgress<T extends InProgressFacts>(
  rows: readonly T[],
  today: string,
  shown: number,
): T[] {
  return uniqueById(rows)
    .filter((lead) => WORKED.has(lead.status))
    .map((lead, index) => ({ lead, index, rank: urgency(lead, today) }))
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, shown)
    .map((entry) => entry.lead);
}
