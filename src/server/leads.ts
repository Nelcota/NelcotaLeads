import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import { idSchema, leadFiltersSchema, updateLeadSchema, updateMessageSchema } from "@/lib/schemas";
import { getAnalyzer } from "@/lib/ai";
import { localDay } from "@/lib/format";
import { leadPatch } from "./lead-status";
import { countLeads, queryLeads } from "./leads-query";
import { writeMessageForLead } from "./process-lead";
import { enqueueLeads, type LeadJob } from "./queue";

export const listLeads = createServerFn({ method: "GET" })
  .validator(leadFiltersSchema)
  .handler(({ data }) => queryLeads(getDb(), data));

export const getLeadCounts = createServerFn({ method: "GET" })
  .validator(leadFiltersSchema)
  .handler(({ data }) => countLeads(getDb(), data));

export const getLead = createServerFn({ method: "GET" })
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data }) => {
    const db = getDb();
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, data.id) });
    if (!lead) throw new Error("Lead não encontrado");
    const [analysis, search] = await Promise.all([
      db.query.analyses.findFirst({
        where: eq(analyses.leadId, lead.id),
        orderBy: [desc(analyses.createdAt), desc(analyses.id)],
      }),
      db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) }),
    ]);
    return { lead, analysis: analysis ?? null, search: search ?? null };
  });

export const updateLead = createServerFn({ method: "POST" })
  .validator(updateLeadSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const current = await db.query.leads.findFirst({
      where: eq(leads.id, data.id),
      columns: { status: true, unsubscribedAt: true, contactedAt: true, followUpOn: true },
    });
    if (!current) throw new Error("Lead não encontrado");
    const now = new Date();
    const patch = leadPatch(current, data, now, localDay(now));
    // Only applies if nobody (e.g. the mail flow) changed the status since it was checked.
    const updated = await db
      .update(leads)
      .set(patch)
      .where(and(eq(leads.id, data.id), eq(leads.status, current.status)))
      .returning({ id: leads.id });
    if (updated.length === 0)
      throw new Error("O lead mudou enquanto isso. Atualize e tente de novo.");
    return { ok: true as const };
  });

export const updateFirstMessage = createServerFn({ method: "POST" })
  .validator(updateMessageSchema)
  .handler(async ({ data }) => {
    await getDb()
      .update(analyses)
      .set({ firstMessage: data.firstMessage || null })
      .where(eq(analyses.id, data.analysisId));
    return { ok: true as const };
  });

/** Explicit re-analysis: the only way an analyzed lead is sent to the model again. */
export const reanalyzeLead = createServerFn({ method: "POST" })
  .validator(z.object({ id: idSchema }))
  .handler(({ data }) => requestReanalysis(getDb(), env.LEAD_QUEUE, data.id));

const REANALYSIS_FAILED_MESSAGE = "Não foi possível pedir a nova análise. Tente de novo.";

/**
 * Queues a forced analysis once: a lead already waiting for (or in) an analysis is left
 * alone, so double clicks and retried requests do not pay for the model twice.
 */
export async function requestReanalysis(db: Db, queue: Queue<LeadJob>, leadId: string) {
  const claimed = await db
    .update(leads)
    .set({ analysisStatus: "pending", analysisError: null })
    .where(
      and(
        eq(leads.id, leadId),
        ne(leads.analysisStatus, "pending"),
        isNull(leads.analysisStartedAt),
      ),
    )
    .returning({ id: leads.id });
  if (claimed.length === 0) {
    const exists = await db.$count(leads, eq(leads.id, leadId));
    if (exists === 0) throw new Error("Lead não encontrado");
    return { ok: true as const, queued: false };
  }
  try {
    await enqueueLeads(queue, [leadId], true);
  } catch (error) {
    console.error("could not enqueue the re-analysis", leadId, error);
    await db
      .update(leads)
      .set({ analysisStatus: "error", analysisError: REANALYSIS_FAILED_MESSAGE })
      .where(and(eq(leads.id, leadId), eq(leads.analysisStatus, "pending")));
    throw new Error(REANALYSIS_FAILED_MESSAGE, { cause: error });
  }
  return { ok: true as const, queued: true };
}

/** On-demand message, e.g. for a lead below the automatic threshold. */
export const generateMessage = createServerFn({ method: "POST" })
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data }) => ({
    firstMessage: await writeMessageForLead({ db: getDb(), analyzer: getAnalyzer(env) }, data.id),
  }));
