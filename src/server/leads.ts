import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import { leadFiltersSchema, updateLeadSchema, updateMessageSchema } from "@/lib/schemas";
import { queryLeads } from "./leads-query";
import { enqueueLeads } from "./queue";

export const listLeads = createServerFn({ method: "GET" })
  .inputValidator(leadFiltersSchema)
  .handler(({ data }) => queryLeads(getDb(), data));

export const getLead = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string().min(1) }))
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
  .inputValidator(updateLeadSchema)
  .handler(async ({ data: { id, ...changes } }) => {
    await getDb().update(leads).set(changes).where(eq(leads.id, id));
    return { ok: true as const };
  });

export const updateFirstMessage = createServerFn({ method: "POST" })
  .inputValidator(updateMessageSchema)
  .handler(async ({ data }) => {
    await getDb()
      .update(analyses)
      .set({ firstMessage: data.firstMessage || null })
      .where(eq(analyses.id, data.analysisId));
    return { ok: true as const };
  });

/** Explicit re-analysis: the only way an analyzed lead is sent to the model again. */
export const reanalyzeLead = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    await getDb()
      .update(leads)
      .set({ analysisStatus: "pending", analysisError: null })
      .where(eq(leads.id, data.id));
    await enqueueLeads(env.LEAD_QUEUE, [data.id], true);
    return { ok: true as const };
  });
