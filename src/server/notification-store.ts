import { and, desc, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { inList } from "@/db/in-list";
import { emails, leads, meetings, notificationReads, searches, users } from "@/db/schema";
import { addDays, brazilInstant, dayDiff, localDay, localTime } from "@/lib/format";
import { splitQuoted } from "@/lib/mail/quoted";
import {
  REPLY_KEY_PREFIX,
  readNotificationPrefs,
  type NotificationItem,
  type NotificationPrefs,
} from "@/lib/notifications";
import { waitingLabel } from "@/lib/overview";
import { MEETING_KIND_LABELS } from "@/lib/schemas";
import { lastInboundAt, lateReply, needsYou } from "./dashboard";

/** How far back the panel looks for replies and finished searches. */
const WINDOW_DAYS = 30;
/** At most this many items per category, newest first. */
const PER_CATEGORY_LIMIT = 40;
/** A meeting starting within this many minutes gets its own "começa em" notification. */
const SOON_MINUTES = 15;
/** A meeting stays in the panel until this long after it started. */
const MEETING_GRACE_MINUTES = 60;
/** Follow-ups waiting for a contact, the same ones as Leads → "Retornar hoje". */
const FOLLOW_UP_STATUSES = ["contacted", "replied"] as const;
/** D1 accepts at most 100 bound values per statement; a read row binds three. */
const READ_INSERT_CHUNK = 30;
/** A cleared row binds four values. */
const DISMISS_CHUNK = 20;

type Draft = Omit<NotificationItem, "unread">;

const PREVIEW_LENGTH = 140;

/** What the lead wrote, on one line, without the quoted original. */
function replyPreview(body: string): string {
  const text = splitQuoted(body).visible.replace(/\s+/g, " ").trim();
  if (text.length <= PREVIEW_LENGTH) return `“${text}”`;
  return `“${text.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…”`;
}

function dayStart(day: string): Date {
  return brazilInstant(day, "00:00");
}

/** Replies from leads (not auto-replies) of the last WINDOW_DAYS; read for the whole team. */
async function replyItems(db: Db, now: Date): Promise<{ drafts: Draft[]; unread: Set<string> }> {
  const receivedAt = sql<Date>`coalesce(${emails.sentAt}, ${emails.createdAt})`.mapWith(
    (value: number) => new Date(value * 1000),
  );
  const since = Math.floor(dayStart(addDays(localDay(now), -WINDOW_DAYS)).getTime() / 1000);
  const rows = await db
    .select({
      id: emails.id,
      leadId: emails.leadId,
      leadName: leads.name,
      body: emails.body,
      readAt: emails.readAt,
      receivedAt,
      ownerId: leads.ownerId,
      ownerName: users.name,
    })
    .from(emails)
    .innerJoin(leads, eq(leads.id, emails.leadId))
    .leftJoin(users, eq(users.id, leads.ownerId))
    .where(
      and(
        eq(emails.direction, "in"),
        eq(emails.automatic, false),
        sql`coalesce(${emails.sentAt}, ${emails.createdAt}) >= ${since}`,
      ),
    )
    .orderBy(desc(sql`coalesce(${emails.sentAt}, ${emails.createdAt})`))
    .limit(PER_CATEGORY_LIMIT);
  const drafts = rows.map((row) => ({
    key: `${REPLY_KEY_PREFIX}${row.id}`,
    category: "replies" as const,
    title: row.leadName,
    text: replyPreview(row.body),
    warning: null,
    at: row.receivedAt.getTime(),
    dueAt: null,
    day: null,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    href: { to: "/conversas" as const, search: { lead: row.leadId } },
  }));
  const unread = new Set(
    rows.filter((row) => row.readAt === null).map((row) => `${REPLY_KEY_PREFIX}${row.id}`),
  );
  return { drafts, unread };
}

function overdueWarning(day: string, today: string): string | null {
  const late = dayDiff(day, today);
  if (late <= 0) return null;
  return late === 1 ? "Atrasado 1 dia" : `Atrasado ${late} dias`;
}

/** Follow-ups due today or already overdue. */
async function followUpItems(db: Db, now: Date): Promise<Draft[]> {
  const today = localDay(now);
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      day: leads.followUpOn,
      ownerId: leads.ownerId,
      ownerName: users.name,
    })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.ownerId))
    .where(and(inArray(leads.status, FOLLOW_UP_STATUSES), lte(leads.followUpOn, today)))
    .orderBy(desc(leads.followUpOn))
    .limit(PER_CATEGORY_LIMIT);
  return rows.flatMap((row) => {
    if (!row.day) return [];
    const isToday = row.day === today;
    return [
      {
        key: `followup:${row.id}:${row.day}`,
        category: "followUps" as const,
        title: row.name,
        text: isToday ? "Retornar o contato hoje" : "Retornar o contato",
        warning: overdueWarning(row.day, today),
        at: brazilInstant(row.day, "08:00").getTime(),
        dueAt: null,
        day: row.day,
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        href: { to: "/leads" as const, search: { view: "all" as const, lead: row.id } },
      },
    ];
  });
}

/** Replies waiting on the team for more than a day (the "esfriando" alert). */
async function lateReplyItems(db: Db, now: Date): Promise<Draft[]> {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      ownerId: leads.ownerId,
      ownerName: users.name,
      inboundAt: sql<number>`${lastInboundAt}`.mapWith(Number),
    })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.ownerId))
    .where(and(needsYou, lateReply(now)))
    .limit(PER_CATEGORY_LIMIT);
  return rows.map((row) => {
    const inboundAt = new Date(row.inboundAt * 1000);
    return {
      key: `late:${row.id}:${row.inboundAt}`,
      category: "followUps" as const,
      title: row.name,
      text: "Respondeu e ninguém da equipe respondeu ainda",
      warning: `Sem resposta ${waitingLabel(inboundAt, now)}`,
      at: inboundAt.getTime(),
      dueAt: null,
      day: null,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      href: { to: "/conversas" as const, search: { lead: row.id } },
    };
  });
}

/** Who a meeting belongs to: the lead's owner, or who booked it while the lead was free. */
const meetingOwner = sql<string | null>`coalesce(${leads.ownerId}, ${meetings.createdBy})`;

type MeetingRow = {
  id: string;
  leadName: string;
  startsAt: Date;
  kind: keyof typeof MEETING_KIND_LABELS;
  ownerId: string | null;
  ownerName: string | null;
};

function meetingItem(row: MeetingRow, now: Date): Draft {
  const time = localTime(row.startsAt);
  const day = localDay(row.startsAt);
  const minutesLeft = Math.ceil((row.startsAt.getTime() - now.getTime()) / 60_000);
  const soon = minutesLeft <= SOON_MINUTES;
  const what = MEETING_KIND_LABELS[row.kind];
  const base = {
    category: "agenda" as const,
    title: row.leadName,
    warning: null,
    dueAt: row.startsAt.getTime(),
    day: null,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    href: { to: "/agenda" as const, search: { view: "dia" as const, date: day } },
  };
  const epoch = Math.floor(row.startsAt.getTime() / 1000);
  if (!soon) {
    return {
      ...base,
      key: `meeting:${row.id}:${epoch}`,
      text: `${what} hoje às ${time}`,
      at: Math.min(now.getTime(), brazilInstant(day, "07:00").getTime()),
    };
  }
  return {
    ...base,
    key: `meeting-soon:${row.id}:${epoch}`,
    text: `${what} às ${time}`,
    at: row.startsAt.getTime() - SOON_MINUTES * 60_000,
  };
}

/** Today's meetings still ahead (or just started); the one about to start notifies again. */
async function agendaItems(db: Db, now: Date): Promise<Draft[]> {
  const today = localDay(now);
  const from = new Date(now.getTime() - MEETING_GRACE_MINUTES * 60_000);
  const rows = await db
    .select({
      id: meetings.id,
      leadName: leads.name,
      startsAt: meetings.startsAt,
      kind: meetings.kind,
      ownerId: meetingOwner,
      ownerName: users.name,
    })
    .from(meetings)
    .innerJoin(leads, eq(leads.id, meetings.leadId))
    .leftJoin(users, eq(users.id, meetingOwner))
    .where(
      and(
        isNull(meetings.cancelledAt),
        ne(leads.status, "discarded"),
        gte(meetings.startsAt, from),
        lt(meetings.startsAt, dayStart(addDays(today, 1))),
      ),
    )
    .limit(PER_CATEGORY_LIMIT);
  return rows.map((row) => meetingItem(row, now));
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function searchText(foundCount: number, origin: "manual" | "autopilot"): string {
  const found = foundCount === 1 ? "1 lead novo" : `${foundCount} leads novos`;
  if (origin === "autopilot") return `${found} · Piloto automático`;
  return found;
}

/** Searches that finished (or stopped with an error) in the last WINDOW_DAYS; for everyone. */
async function searchItems(db: Db, now: Date): Promise<Draft[]> {
  const since = dayStart(addDays(localDay(now), -WINDOW_DAYS));
  const rows = await db
    .select({
      id: searches.id,
      niche: searches.niche,
      city: searches.city,
      status: searches.status,
      foundCount: searches.foundCount,
      origin: searches.origin,
      createdAt: searches.createdAt,
    })
    .from(searches)
    .where(
      and(
        inArray(searches.status, ["done", "error"]),
        isNull(searches.hiddenAt),
        gte(searches.createdAt, since),
      ),
    )
    .orderBy(desc(searches.createdAt))
    .limit(PER_CATEGORY_LIMIT);
  return rows.map((row) => ({
    key: `search:${row.id}`,
    category: "searches" as const,
    title: capitalize(`${row.niche} em ${row.city}`),
    text: searchText(row.foundCount, row.origin),
    warning: row.status === "error" ? "Parou com erro" : null,
    at: row.createdAt.getTime(),
    dueAt: null,
    day: null,
    ownerId: null,
    ownerName: null,
    href: { to: "/searches/$searchId" as const, params: { searchId: row.id } },
  }));
}

type PersonMarks = { read: Set<string>; dismissed: Set<string> };

/**
 * This person's marks on the given keys: which they read (a row means read; replies are read on
 * the e-mail instead) and which they cleared.
 */
async function personMarks(db: Db, userId: string, keys: readonly string[]): Promise<PersonMarks> {
  if (keys.length === 0) return { read: new Set(), dismissed: new Set() };
  const rows = await db
    .select({ key: notificationReads.key, dismissedAt: notificationReads.dismissedAt })
    .from(notificationReads)
    .where(and(eq(notificationReads.userId, userId), inList(notificationReads.key, keys)));
  return {
    read: new Set(rows.map((row) => row.key)),
    dismissed: new Set(rows.filter((row) => row.dismissedAt !== null).map((row) => row.key)),
  };
}

/** Every notification of the team this person did not clear, with their read marks. */
export async function loadNotifications(db: Db, userId: string, now = new Date()) {
  const [replies, followUps, late, agenda, found] = await Promise.all([
    replyItems(db, now),
    followUpItems(db, now),
    lateReplyItems(db, now),
    agendaItems(db, now),
    searchItems(db, now),
  ]);
  const others = [...followUps, ...late, ...agenda, ...found];
  const marks = await personMarks(db, userId, [
    ...replies.drafts.map((item) => item.key),
    ...others.map((item) => item.key),
  ]);
  const items: NotificationItem[] = [
    ...replies.drafts.map((item) => ({ ...item, unread: replies.unread.has(item.key) })),
    ...others.map((item) => ({ ...item, unread: !marks.read.has(item.key) })),
  ];
  return items.filter((item) => !marks.dismissed.has(item.key));
}

export async function loadNotificationPrefs(db: Db, userId: string): Promise<NotificationPrefs> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { notificationPrefs: true },
  });
  return readNotificationPrefs(row?.notificationPrefs);
}

export function storeNotificationPrefs(db: Db, userId: string, prefs: NotificationPrefs) {
  return db.update(users).set({ notificationPrefs: prefs }).where(eq(users.id, userId));
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    result.push(values.slice(start, start + size));
  }
  return result;
}

/** Marks notifications read: replies on the e-mail (for everyone), the rest for this person. */
export async function markNotificationsRead(
  db: Db,
  userId: string,
  keys: readonly string[],
  now = new Date(),
) {
  const replyIds = keys
    .filter((key) => key.startsWith(REPLY_KEY_PREFIX))
    .map((key) => key.slice(REPLY_KEY_PREFIX.length));
  const others = keys.filter((key) => !key.startsWith(REPLY_KEY_PREFIX));
  if (replyIds.length > 0) {
    await db
      .update(emails)
      .set({ readAt: now })
      .where(and(inList(emails.id, replyIds), isNull(emails.readAt)));
  }
  for (const chunk of chunks(others, READ_INSERT_CHUNK)) {
    await db
      .insert(notificationReads)
      .values(chunk.map((key) => ({ userId, key, readAt: now })))
      .onConflictDoNothing();
  }
}

/** "Limpar": the notifications leave this person's panel; a reply stays unread for the team. */
export async function dismissNotifications(
  db: Db,
  userId: string,
  keys: readonly string[],
  now = new Date(),
) {
  for (const chunk of chunks(keys, DISMISS_CHUNK)) {
    await db
      .insert(notificationReads)
      .values(chunk.map((key) => ({ userId, key, readAt: now, dismissedAt: now })))
      .onConflictDoUpdate({
        target: [notificationReads.userId, notificationReads.key],
        set: { dismissedAt: now },
      });
  }
}

/** Every reply of a lead is read once someone opens its conversation. */
export function markLeadRepliesRead(db: Db, leadId: string, now = new Date()) {
  return db
    .update(emails)
    .set({ readAt: now })
    .where(and(eq(emails.leadId, leadId), eq(emails.direction, "in"), isNull(emails.readAt)));
}
