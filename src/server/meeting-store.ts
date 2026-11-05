import type { BatchItem } from "drizzle-orm/batch";
import { and, asc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { inList } from "@/db/in-list";
import { emails, leadEvents, leads, meetings, type Lead } from "@/db/schema";
import { brazilInstant, localDay } from "@/lib/format";
import { MEETING_CANCELLED } from "@/lib/lead-history";
import { PAST_MEETING_MESSAGE, type MeetingInput } from "@/lib/meetings";
import { meetingInviteEmail } from "@/lib/sales-email";
import { LEAD_NOT_FOUND } from "@/lib/schemas";
import { leadEvent } from "./lead-events";
import { assertCanEmail, queuedSalesEmail, type SalesMailDeps } from "./sales-mail";

export const MEETING_NOT_FOUND = "Reunião não encontrada. Atualize a página.";

export const LEAD_ENDED_MESSAGE =
  "Este lead já foi encerrado. Reabra a conversa antes de marcar reunião ou montar proposta.";

/** Meetings and proposals are for leads still in play, never for a closed or discarded one. */
export function assertLeadOpen(lead: Pick<Lead, "status">) {
  if (lead.status === "closed" || lead.status === "discarded") throw new Error(LEAD_ENDED_MESSAGE);
}

/**
 * A replied lead without a stage moves to Reunião when a meeting is booked; one already at
 * Reunião or Proposta stays where it is. The history line is written only when the guarded
 * update changed the lead (nobody moved it meanwhile).
 */
async function moveToMeetingStage(db: Db, lead: Lead, userId: string | null, now: Date) {
  if (lead.status !== "replied" || lead.salesStage !== null) return;
  const moved = await db
    .update(leads)
    .set({ salesStage: "meeting" })
    .where(and(eq(leads.id, lead.id), eq(leads.status, "replied"), isNull(leads.salesStage)))
    .returning({ id: leads.id });
  if (moved.length === 0) return;
  await db
    .insert(leadEvents)
    .values(leadEvent(lead.id, "stage", { from: null, to: "meeting" }, userId, now));
}

/**
 * "Agendar reunião": records the meeting and its history line, moves the stage when it applies
 * and, with `sendInvite`, queues the invite e-mail (only while SALES_EMAILS_ENABLED is on).
 * Returns the invite text either way, so it can be copied when it was not sent.
 */
export async function scheduleMeeting(
  db: Db,
  input: MeetingInput,
  userId: string | null,
  deps: SalesMailDeps,
  now = new Date(),
) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, input.leadId) });
  if (!lead) throw new Error(LEAD_NOT_FOUND);
  assertLeadOpen(lead);
  const startsAt = brazilInstant(input.day, input.time);
  if (startsAt <= now) throw new Error(PAST_MEETING_MESSAGE);
  if (input.sendInvite) assertCanEmail(lead, deps);

  const id = crypto.randomUUID();
  const invite = meetingInviteEmail({
    leadName: lead.name,
    startsAt,
    kind: input.kind,
    note: input.note,
  });
  const inviteEmailId = input.sendInvite ? crypto.randomUUID() : null;
  const statements: BatchItem<"sqlite">[] = [
    db.insert(meetings).values({
      id,
      leadId: lead.id,
      startsAt,
      kind: input.kind,
      note: input.note,
      inviteEmailId,
      createdBy: userId,
      createdAt: now,
    }),
    db
      .insert(leadEvents)
      .values(leadEvent(lead.id, "meeting", { to: startsAt.toISOString() }, userId, now)),
  ];
  if (inviteEmailId && lead.email) {
    statements.push(
      queuedSalesEmail(
        db,
        {
          id: inviteEmailId,
          leadId: lead.id,
          toAddress: lead.email,
          fromAddress: deps.fromAddress,
          text: invite,
        },
        now,
      ),
    );
  }
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
  await moveToMeetingStage(db, lead, userId, now);
  return { id, invite, queued: inviteEmailId !== null };
}

/**
 * "Cancelar": the meeting leaves the agenda and the history says so. An invite still waiting in
 * the queue is cancelled with it; one already sent stays sent.
 */
export async function cancelMeeting(db: Db, id: string, userId: string | null, now = new Date()) {
  const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, id) });
  if (!meeting) throw new Error(MEETING_NOT_FOUND);
  if (meeting.cancelledAt) return { ok: true as const };
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(meetings)
      .set({ cancelledAt: now })
      .where(and(eq(meetings.id, id), isNull(meetings.cancelledAt))),
    db
      .insert(leadEvents)
      .values(
        leadEvent(
          meeting.leadId,
          "meeting",
          { from: meeting.startsAt.toISOString(), to: MEETING_CANCELLED },
          userId,
          now,
        ),
      ),
  ];
  if (meeting.inviteEmailId) {
    statements.push(
      db
        .update(emails)
        .set({ status: "cancelled", error: "Cancelado: reunião cancelada" })
        .where(
          and(
            eq(emails.id, meeting.inviteEmailId),
            eq(emails.status, "queued"),
            isNull(emails.sentAt),
          ),
        ),
    );
  }
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
  return { ok: true as const };
}

/** The lead's meetings from today on, not cancelled, soonest first. */
export function upcomingMeetings(db: Db, leadId: string, now = new Date()) {
  const todayStart = brazilInstant(localDay(now), "00:00");
  return db
    .select({
      id: meetings.id,
      startsAt: meetings.startsAt,
      kind: meetings.kind,
      note: meetings.note,
      inviteEmailId: meetings.inviteEmailId,
    })
    .from(meetings)
    .where(
      and(
        eq(meetings.leadId, leadId),
        isNull(meetings.cancelledAt),
        gte(meetings.startsAt, todayStart),
      ),
    )
    .orderBy(asc(meetings.startsAt));
}

export type UpcomingMeeting = Awaited<ReturnType<typeof upcomingMeetings>>[number];

export const MEETING_CLOSED_REASON = "Cancelado: negócio encerrado";

/** The lead's meetings still ahead (after `now`) and not cancelled. */
export async function futureMeetingIds(db: Db, leadId: string, now: Date): Promise<string[]> {
  const rows = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(
      and(eq(meetings.leadId, leadId), isNull(meetings.cancelledAt), gt(meetings.startsAt, now)),
    );
  return rows.map((row) => row.id);
}

/**
 * A deal that ended (won or lost) has nothing left to meet about: its upcoming meetings leave
 * the agenda and their invites still waiting in the queue are cancelled. Returns the statements
 * (which match nothing for an empty list), so the caller can run them with the close.
 */
export function cancelMeetingsStatements(
  db: Db,
  leadId: string,
  ids: readonly string[],
  now: Date,
) {
  return [
    db
      .update(meetings)
      .set({ cancelledAt: now })
      .where(
        and(inList(meetings.id, ids), eq(meetings.leadId, leadId), isNull(meetings.cancelledAt)),
      ),
    db
      .update(emails)
      .set({ status: "cancelled", error: MEETING_CLOSED_REASON })
      .where(
        and(
          eq(emails.leadId, leadId),
          eq(emails.status, "queued"),
          isNull(emails.sentAt),
          sql`${emails.id} in (select m.invite_email_id from meetings m where m.id in (select value from json_each(${JSON.stringify(ids)})))`,
        ),
      ),
  ] as const;
}

/** Cancels the lead's upcoming meetings (and queued invites) now; for closes outside a batch. */
export async function cancelFutureMeetings(db: Db, leadId: string, now: Date) {
  const ids = await futureMeetingIds(db, leadId, now);
  if (ids.length === 0) return ids;
  await db.batch(cancelMeetingsStatements(db, leadId, ids, now));
  return ids;
}
