import { and, desc, eq, isNull, lte, ne, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import type { LeadAnalyzer } from "@/lib/ai";
import { dayDiff, localDay } from "@/lib/format";
import { buildContext, hasOffer } from "./process-lead";
import { loadSettings } from "./settings-store";
import { recordAiCost } from "./usage";

/**
 * Writes a reminder for each contacted lead whose follow-up day has come, once per day
 * scheduled. Leads without a first message on record are left alone.
 */
export async function draftFollowUps(
  deps: { db: Db; analyzer: LeadAnalyzer },
  today: string,
  limit = 10,
): Promise<number> {
  const { db, analyzer } = deps;
  const due = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.status, "contacted"),
        lte(leads.followUpOn, today),
        or(isNull(leads.followUpMessageFor), ne(leads.followUpMessageFor, leads.followUpOn)),
      ),
    )
    .limit(limit);
  if (due.length === 0) return 0;

  const settings = await loadSettings(db);
  if (!hasOffer(settings)) return 0;
  let drafted = 0;
  for (const lead of due) {
    const [analysis, search] = await Promise.all([
      db.query.analyses.findFirst({
        where: eq(analyses.leadId, lead.id),
        orderBy: [desc(analyses.createdAt), desc(analyses.id)],
      }),
      db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) }),
    ]);
    if (!analysis?.firstMessage) continue;
    try {
      const sentOn = lead.contactedAt ? localDay(lead.contactedAt) : today;
      const { message, usage } = await analyzer.writeFollowUp(
        settings,
        buildContext(lead, search),
        {
          firstMessage: analysis.firstMessage,
          daysSince: Math.max(1, dayDiff(sentOn, today)),
        },
      );
      await db
        .update(leads)
        .set({ followUpMessage: message, followUpMessageFor: lead.followUpOn })
        .where(eq(leads.id, lead.id));
      await recordAiCost(db, 1, usage.cost);
      drafted += 1;
    } catch (error) {
      // One failed reminder should not block the others; the next tick retries it.
      console.error("follow-up draft failed", lead.id, error);
    }
  }
  return drafted;
}
