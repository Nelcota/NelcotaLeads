import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import {
  BULK_LIMIT,
  bulkSnapshotSchema,
  idSchema,
  LEAD_NOT_FOUND,
  LEAD_STATUS_VALUES,
  leadFiltersSchema,
  updateLeadSchema,
  updateMessageSchema,
} from "@/lib/schemas";
import { getAnalyzer } from "@/lib/ai";
import { CONTACT_FIELDS, CONTACT_LIMITS } from "@/lib/lead-contact";
import { localDay } from "@/lib/format";
import { bulkUpdateLeads as bulkUpdate, undoBulkUpdate } from "./lead-bulk";
import { editLeadContact } from "./lead-edit";
import { createManualLead } from "./manual-lead";
import { leadPatch } from "./lead-status";
import { countLeads, LIST_LIMIT, queryLeadsCapped } from "./leads-query";
import { CLAIM_TIMEOUT_MS, writeMessageForLead } from "./process-lead";
import { enqueueLeads, type LeadJob } from "./queue";

/** The table's rows, and whether more leads matched than it shows (LIST_LIMIT). */
export const listLeads = createServerFn({ method: "GET" })
  .validator(leadFiltersSchema)
  .handler(({ data }) => queryLeadsCapped(getDb(), data, LIST_LIMIT));

export const getLeadCounts = createServerFn({ method: "GET" })
  .validator(leadFiltersSchema)
  .handler(({ data }) => countLeads(getDb(), data));

export const getLead = createServerFn({ method: "GET" })
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data }) => {
    const db = getDb();
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, data.id) });
    if (!lead) throw new Error(LEAD_NOT_FOUND);
    const [analysis, search] = await Promise.all([
      db.query.analyses.findFirst({
        where: eq(analyses.leadId, lead.id),
        orderBy: [desc(analyses.createdAt), desc(analyses.id)],
      }),
      db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) }),
    ]);
    return { lead, analysis: analysis ?? null, search: search ?? null };
  });

/** For old /leads/<id> links: whether that lead still exists. */
export const leadExists = createServerFn({ method: "GET" })
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data }) => (await getDb().$count(leads, eq(leads.id, data.id))) > 0);

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

/** One contact field (nome, e-mail, telefone, site) edited in the lead panel. */
export const updateLeadContact = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: idSchema,
      field: z.enum(CONTACT_FIELDS),
      value: z.string().max(CONTACT_LIMITS.website),
    }),
  )
  .handler(({ data }) => editLeadContact(getDb(), data));

/** "Adicionar lead": a lead typed in by hand (see createManualLead). */
export const createLead = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().max(CONTACT_LIMITS.name),
      email: z.string().max(CONTACT_LIMITS.email).optional(),
      phone: z.string().max(CONTACT_LIMITS.phone).optional(),
      website: z.string().max(CONTACT_LIMITS.website).optional(),
    }),
  )
  .handler(({ data }) => createManualLead(getDb(), env.LEAD_QUEUE, data));

/** "Mudar status" and "Descartar" on the selection bar. */
export const bulkUpdateLeads = createServerFn({ method: "POST" })
  .validator(
    z.object({ ids: z.array(idSchema).min(1).max(BULK_LIMIT), status: z.enum(LEAD_STATUS_VALUES) }),
  )
  .handler(({ data }) => bulkUpdate(getDb(), data.ids, data.status));

/** "Desfazer" of a bulk change: the leads it changed go back as they were. */
export const undoBulkUpdateLeads = createServerFn({ method: "POST" })
  .validator(
    z.object({
      status: z.enum(LEAD_STATUS_VALUES),
      previous: z.array(bulkSnapshotSchema).max(BULK_LIMIT),
    }),
  )
  .handler(({ data }) => undoBulkUpdate(getDb(), data.status, data.previous));

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

/** A pending lead nobody picked up for this long is assumed lost (e.g. its queue message). */
const PENDING_TIMEOUT_MS = 60 * 60_000;

/**
 * Queues a forced analysis once: a lead already waiting for (or in) an analysis is left
 * alone, so double clicks and retried requests do not pay for the model twice. A lead that
 * has been pending for too long without a job picking it up can be queued again.
 */
export async function requestReanalysis(
  db: Db,
  queue: Queue<LeadJob>,
  leadId: string,
  now = new Date(),
) {
  const lostBefore = Math.floor((now.getTime() - PENDING_TIMEOUT_MS) / 1000);
  const claimed = await db
    .update(leads)
    .set({ analysisStatus: "pending", analysisError: null, analysisQueuedAt: now })
    .where(
      and(
        eq(leads.id, leadId),
        or(
          isNull(leads.analysisStartedAt),
          lt(leads.analysisStartedAt, new Date(now.getTime() - CLAIM_TIMEOUT_MS)),
        ),
        or(
          ne(leads.analysisStatus, "pending"),
          sql`coalesce(${leads.analysisQueuedAt}, ${leads.createdAt}) < ${lostBefore}`,
        ),
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
