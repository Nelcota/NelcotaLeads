import type { BatchItem } from "drizzle-orm/batch";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  emails,
  leadEvents,
  leads,
  proposals,
  serviceAddons,
  services,
  type Lead,
} from "@/db/schema";
import { localDay } from "@/lib/format";
import { MAX_DEAL_CENTS } from "@/lib/money";
import {
  buildProposalItems,
  PROPOSAL_VALID_DAYS,
  proposalTotals,
  type ProposalInput,
} from "@/lib/proposal";
import { proposalEmail } from "@/lib/sales-email";
import { LEAD_NOT_FOUND } from "@/lib/schemas";
import { leadEvent } from "./lead-events";
import { assertLeadOpen } from "./meeting-store";
import { assertCanEmail, queuedSalesEmail, type SalesMailDeps } from "./sales-mail";
import { ADDON_NOT_FOUND, SERVICE_NOT_FOUND } from "./service-store";

export const PROPOSAL_TOO_HIGH_MESSAGE =
  "O total da proposta passou do limite. Confira os valores.";

/** The service and add-ons picked, read from the table (archived rows no longer count). */
async function pickedRows(db: Db, serviceId: string, addonIds: readonly string[]) {
  const ids = [...new Set(addonIds)];
  const [service, addons] = await Promise.all([
    db.query.services.findFirst({
      where: and(eq(services.id, serviceId), isNull(services.archivedAt)),
    }),
    ids.length === 0
      ? Promise.resolve([])
      : db
          .select()
          .from(serviceAddons)
          .where(and(inArray(serviceAddons.id, ids), isNull(serviceAddons.archivedAt)))
          .orderBy(asc(serviceAddons.position)),
  ]);
  if (!service) throw new Error(SERVICE_NOT_FOUND);
  if (addons.length !== ids.length) throw new Error(ADDON_NOT_FOUND);
  return { service, addons };
}

/**
 * A replied lead moves to Proposta (from no stage or Reunião). The history line is written only
 * when the guarded update changed the lead (nobody moved it meanwhile).
 */
async function moveToProposalStage(db: Db, lead: Lead, userId: string | null, now: Date) {
  if (lead.status !== "replied" || lead.salesStage === "proposal") return;
  const moved = await db
    .update(leads)
    .set({ salesStage: "proposal" })
    .where(
      and(
        eq(leads.id, lead.id),
        eq(leads.status, "replied"),
        lead.salesStage ? eq(leads.salesStage, lead.salesStage) : isNull(leads.salesStage),
      ),
    )
    .returning({ id: leads.id });
  if (moved.length === 0) return;
  await db
    .insert(leadEvents)
    .values(leadEvent(lead.id, "stage", { from: lead.salesStage, to: "proposal" }, userId, now));
}

/**
 * "Salvar proposta" / "Enviar proposta por e-mail": the lines are copied from the table as they
 * are now, so a later price change never rewrites what the client got. Moves a replied lead to
 * Proposta and, with `sendEmail` (only while SALES_EMAILS_ENABLED is on), queues the e-mail.
 */
export async function saveProposal(
  db: Db,
  input: ProposalInput,
  userId: string | null,
  deps: SalesMailDeps,
  now = new Date(),
) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, input.leadId) });
  if (!lead) throw new Error(LEAD_NOT_FOUND);
  assertLeadOpen(lead);
  const { service, addons } = await pickedRows(db, input.serviceId, input.addonIds);
  const items = buildProposalItems(service, addons, input.custom);
  const { totalCents } = proposalTotals(items);
  if (totalCents > MAX_DEAL_CENTS) throw new Error(PROPOSAL_TOO_HIGH_MESSAGE);
  if (input.sendEmail) assertCanEmail(lead, deps);

  const id = crypto.randomUUID();
  const email = proposalEmail({
    leadName: lead.name,
    items,
    validDays: PROPOSAL_VALID_DAYS,
    today: localDay(now),
  });
  const emailId = input.sendEmail ? crypto.randomUUID() : null;
  const statements: BatchItem<"sqlite">[] = [
    db.insert(proposals).values({
      id,
      leadId: lead.id,
      items,
      totalCents,
      validDays: PROPOSAL_VALID_DAYS,
      // Set by the send once the e-mail actually goes out.
      emailId,
      sentAt: null,
      createdBy: userId,
      createdAt: now,
    }),
    db
      .insert(leadEvents)
      .values(
        leadEvent(
          lead.id,
          "proposal",
          { from: emailId ? "email" : null, to: String(totalCents) },
          userId,
          now,
        ),
      ),
  ];
  if (emailId && lead.email) {
    statements.push(
      queuedSalesEmail(
        db,
        {
          id: emailId,
          leadId: lead.id,
          toAddress: lead.email,
          fromAddress: deps.fromAddress,
          text: email,
        },
        now,
      ),
    );
  }
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
  await moveToProposalStage(db, lead, userId, now);
  return { id, totalCents, email, queued: emailId !== null };
}

/**
 * The lead's newest proposal, or null; "Fechar negócio" starts from it. `emailStatus` is the
 * status of the e-mail that carries it (queued, sent, failed, cancelled), null when it was not
 * e-mailed: the panel says "na fila", "enviada" or "falhou" from it, never from the save.
 */
export async function latestProposal(db: Db, leadId: string) {
  const [proposal] = await db
    .select({
      id: proposals.id,
      items: proposals.items,
      totalCents: proposals.totalCents,
      validDays: proposals.validDays,
      sentAt: proposals.sentAt,
      createdAt: proposals.createdAt,
      emailStatus: emails.status,
    })
    .from(proposals)
    .leftJoin(emails, eq(emails.id, proposals.emailId))
    .where(eq(proposals.leadId, leadId))
    .orderBy(desc(proposals.createdAt), desc(proposals.id))
    .limit(1);
  return proposal ?? null;
}

export type LatestProposal = NonNullable<Awaited<ReturnType<typeof latestProposal>>>;
