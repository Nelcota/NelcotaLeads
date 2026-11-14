import type { Db } from "@/db/client";
import { localDay } from "@/lib/format";
import { leadsInProgress, PROFILE_LEADS_SHOWN } from "@/lib/partner-leads";
import { queryLeads } from "./leads-query";

/**
 * "Em andamento" in a partner's profile. Three small reads of the Leads list, each capped at
 * what the profile shows (follow-ups due or overdue, conversations, contacted leads waiting),
 * then ranked; the full "Todos" list (up to 1000 rows with the analysis text) is never sent
 * just to show five.
 */
export async function partnerLeadsInProgress(db: Db, owner: string, now: Date) {
  const today = localDay(now);
  const shown = PROFILE_LEADS_SHOWN;
  const [followUps, talking, waiting] = await Promise.all([
    queryLeads(db, { owner, view: "followup" }, today, shown, now),
    queryLeads(db, { owner, view: "talking" }, today, shown, now),
    queryLeads(db, { owner, view: "waiting" }, today, shown, now),
  ]);
  return leadsInProgress([...followUps, ...talking, ...waiting], today, shown);
}
