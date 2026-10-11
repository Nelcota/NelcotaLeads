import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import { leadFiltersSchema, updateLeadSchema, updateMessageSchema } from "@/lib/schemas";
import { getAnalyzer } from "@/lib/ai";
import { localDay } from "@/lib/format";
import { leadPatch } from "./lead-status";
import { countLeads, queryLeads } from "./leads-query";
import { writeMessageForLead } from "./process-lead";
import { enqueueLeads } from "./queue";

export const listLeads = createServerFn({ method: "GET" })
  .validator(leadFiltersSchema)
  .handler(({ data }) => queryLeads(getDb(), data));

export const getLeadCounts = createServerFn({ method: "GET" })
  .validator(leadFiltersSchema)
  .handler(({ data }) => countLeads(getDb(), data));

export const getLead = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
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
      columns: { contactedAt: true, followUpOn: true },
    });
    if (!current) throw new Error("Lead não encontrado");
    const now = new Date();
    await db
      .update(leads)
      .set(leadPatch(current, data, now, localDay(now)))
      .where(eq(leads.id, data.id));
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
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await getDb()
      .update(leads)
      .set({ analysisStatus: "pending", analysisError: null })
      .where(eq(leads.id, data.id));
    await enqueueLeads(env.LEAD_QUEUE, [data.id], true);
    return { ok: true as const };
  });

/** On-demand message, e.g. for a lead below the automatic threshold. */
export const generateMessage = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => ({
    firstMessage: await writeMessageForLead({ db: getDb(), analyzer: getAnalyzer(env) }, data.id),
  }));

export const updateFollowUpMessage = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), message: z.string().trim().max(2000) }))
  .handler(async ({ data }) => {
    await getDb()
      .update(leads)
      .set({ followUpMessage: data.message || null })
      .where(eq(leads.id, data.id));
    return { ok: true as const };
  });
