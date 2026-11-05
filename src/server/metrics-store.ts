import { and, between, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { apiUsage, emails, leads } from "@/db/schema";
import type { ReplyRate } from "@/lib/overview-metrics";
import type { DayRange } from "@/lib/period";
import type { LossReason } from "@/lib/schemas";
import { DEEPSEEK } from "./usage";

type Bounds = Pick<DayRange, "from" | "to">;

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

/** When each lead got its first e-mail that went out: the start of its contact. */
export const FIRST_CONTACT = sql`first_contact as (
  select lead_id, min(sent_at) as at from emails
  where direction = 'out' and status = 'sent' and sent_at is not null
  group by lead_id
)`;

/** The lead wrote back: machine mail (out-of-office, auto-replies) does not count. */
export const wroteBack = sql`exists(select 1 from emails i where i.lead_id = l.id and i.direction = 'in' and i.automatic = 0)`;

/** The lead (`l`) closed a deal: counted inside a cohort, whenever it closed. */
export const cohortWon = sql`(l.status = 'closed')`;

/** The lead (`l`) was lost with a reason (a person's "Encerrar sem negócio"), not an AI triage. */
export const cohortLost = sql`(l.status = 'discarded' and l.loss_reason is not null)`;

export type PeriodFunnel = {
  /** Leads found in the period. */
  found: number;
  withEmail: number;
  /** Leads whose first e-mail went out in the period, and of those: */
  contacted: number;
  replied: number;
  /** Replied, handed to a person and still waiting (the "Precisam de você" rule). */
  interested: number;
  /** Of the leads first contacted in the period, how many are now won and lost (a cohort). */
  won: number;
  lost: number;
};

/**
 * The funnel of a period: leads found in it, and leads first contacted in it with what became
 * of them (replied, won, lost), so every share of the contacted stays within 100%.
 */
export async function periodFunnel(db: Db, range: Bounds): Promise<PeriodFunnel> {
  const from = seconds(range.from);
  const to = seconds(range.to);
  const [found, contacted] = await Promise.all([
    db.get<{ found: number; withEmail: number }>(sql`
      select count(*) as found, coalesce(sum(email is not null), 0) as withEmail
      from leads where created_at >= ${from} and created_at < ${to}`),
    db.get<{
      contacted: number;
      replied: number;
      interested: number;
      won: number;
      lost: number;
    }>(sql`
      with ${FIRST_CONTACT}
      select count(*) as contacted,
        coalesce(sum(${wroteBack}), 0) as replied,
        coalesce(sum(l.status = 'replied' and l.ai_mode = 0 and l.unsubscribed_at is null), 0)
          as interested,
        coalesce(sum(${cohortWon}), 0) as won,
        coalesce(sum(${cohortLost}), 0) as lost
      from first_contact f inner join leads l on l.id = f.lead_id
      where f.at >= ${from} and f.at < ${to}`),
  ]);
  return {
    found: found?.found ?? 0,
    withEmail: found?.withEmail ?? 0,
    contacted: contacted?.contacted ?? 0,
    replied: contacted?.replied ?? 0,
    interested: contacted?.interested ?? 0,
    won: contacted?.won ?? 0,
    lost: contacted?.lost ?? 0,
  };
}

/** A lead lost in the range: discarded with a reason, at a time inside it. */
function lostIn(range: Bounds) {
  return and(
    eq(leads.status, "discarded"),
    isNotNull(leads.lossReason),
    gte(leads.lostAt, range.from),
    lt(leads.lostAt, range.to),
  );
}

/** Deals lost in the range, by reason (only the reasons that happened). */
export async function lossCounts(
  db: Db,
  range: Bounds,
): Promise<{ reason: LossReason; count: number }[]> {
  const rows = await db
    .select({ reason: leads.lossReason, count: sql<number>`count(*)`.mapWith(Number) })
    .from(leads)
    .where(lostIn(range))
    .groupBy(leads.lossReason);
  return rows.flatMap((row) => (row.reason ? [{ reason: row.reason, count: row.count }] : []));
}

/** E-mails that went out in the range, how many bounced, and leads that unsubscribed in it. */
export async function sendingInRange(db: Db, range: Bounds) {
  const [sent, unsubscribed] = await Promise.all([
    db
      .select({
        sent: sql<number>`count(*)`.mapWith(Number),
        bounced: sql<number>`coalesce(sum(${emails.bouncedAt} is not null), 0)`.mapWith(Number),
      })
      .from(emails)
      .where(
        and(
          eq(emails.direction, "out"),
          eq(emails.status, "sent"),
          gte(emails.sentAt, range.from),
          lt(emails.sentAt, range.to),
        ),
      ),
    db
      .select({ value: sql<number>`count(*)`.mapWith(Number) })
      .from(leads)
      .where(and(gte(leads.unsubscribedAt, range.from), lt(leads.unsubscribedAt, range.to))),
  ]);
  return {
    sent: sent[0]?.sent ?? 0,
    bounced: sent[0]?.bounced ?? 0,
    unsubscribed: unsubscribed[0]?.value ?? 0,
  };
}

/** AI spend (US$) on the Brazil days `fromDay` through `toDay`. */
export async function aiCostBetween(db: Db, range: Pick<DayRange, "fromDay" | "toDay">) {
  const rows = await db
    .select({ value: sql<number>`coalesce(sum(${apiUsage.costUsd}), 0)`.mapWith(Number) })
    .from(apiUsage)
    .where(and(eq(apiUsage.provider, DEEPSEEK), between(apiUsage.day, range.fromDay, range.toDay)));
  return rows[0]?.value ?? 0;
}

/**
 * First e-mails sent in the range by who wrote them (the AI or a person), and how many of
 * those leads wrote back after it. A first e-mail is the lead's earliest one that went out.
 */
export async function firstEmailReplies(
  db: Db,
  range: Bounds,
): Promise<{ ai: ReplyRate; user: ReplyRate }> {
  const rows = await db.all<{ author: "ai" | "user"; sent: number; replied: number }>(sql`
    with firsts as (
      select e.lead_id, e.author, e.sent_at from emails e
      where e.direction = 'out' and e.status = 'sent' and e.sent_at is not null
        and e.author in ('ai', 'user')
        and not exists (
          select 1 from emails p
          where p.lead_id = e.lead_id and p.direction = 'out' and p.status = 'sent'
            and (p.sent_at < e.sent_at or (p.sent_at = e.sent_at and p.id < e.id))
        )
    )
    select f.author as author, count(*) as sent,
      coalesce(sum(exists(
        select 1 from emails i
        where i.lead_id = f.lead_id and i.direction = 'in' and i.automatic = 0
          and i.sent_at >= f.sent_at
      )), 0) as replied
    from firsts f
    where f.sent_at >= ${seconds(range.from)} and f.sent_at < ${seconds(range.to)}
    group by f.author`);
  const of = (author: "ai" | "user") => {
    const row = rows.find((item) => item.author === author);
    return { sent: row?.sent ?? 0, replied: row?.replied ?? 0 };
  };
  return { ai: of("ai"), user: of("user") };
}
