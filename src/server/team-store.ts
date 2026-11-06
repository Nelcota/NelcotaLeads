import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { invites, users } from "@/db/schema";
import {
  ALREADY_INVITED_MESSAGE,
  ALREADY_MEMBER_MESSAGE,
  INVITE_NOT_FOUND_MESSAGE,
} from "@/lib/team";

/** Everyone with an account, with how many leads each one has taken. Oldest account first. */
export async function teamWithLeads(db: Db) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      // Spelled out: inside a one-table select drizzle leaves column names unqualified.
      leads: sql<number>`(select count(*) from leads l where l.owner_id = users.id)`.mapWith(
        Number,
      ),
    })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.name));
}

/** Invites nobody accepted yet, oldest first. */
export async function pendingInvites(db: Db) {
  return db
    .select({ id: invites.id, email: invites.email, createdAt: invites.createdAt })
    .from(invites)
    .where(isNull(invites.acceptedAt))
    .orderBy(asc(invites.createdAt), asc(invites.email));
}

/**
 * Stores an invite for `email` (already lowercased). Refuses an address that already has an
 * account or a pending invite; an accepted invite whose account was removed is renewed.
 */
export async function createInvite(
  db: Db,
  email: string,
  invitedBy: string | null,
  now: Date,
): Promise<{ id: string; email: string }> {
  const member = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (member) throw new Error(ALREADY_MEMBER_MESSAGE);
  const id = crypto.randomUUID();
  const [stored] = await db
    .insert(invites)
    .values({ id, email, invitedBy, createdAt: now })
    .onConflictDoUpdate({
      target: invites.email,
      set: { id, invitedBy, acceptedAt: null, createdAt: now },
      // Only an accepted invite is renewed; a pending one stays as it is.
      setWhere: sql`${invites.acceptedAt} is not null`,
    })
    .returning({ id: invites.id, email: invites.email });
  if (!stored) throw new Error(ALREADY_INVITED_MESSAGE);
  return stored;
}

/** "Remover" on a pending invite; an accepted one is history and stays. */
export async function removeInvite(db: Db, id: string): Promise<void> {
  const removed = await db
    .delete(invites)
    .where(and(eq(invites.id, id), isNull(invites.acceptedAt)))
    .returning({ id: invites.id });
  if (removed.length === 0) throw new Error(INVITE_NOT_FOUND_MESSAGE);
}

/** Whether `email` has an invite nobody used yet. */
export async function hasPendingInvite(db: Db, email: string): Promise<boolean> {
  const row = await db.query.invites.findFirst({
    where: and(eq(invites.email, email), isNull(invites.acceptedAt)),
    columns: { id: true },
  });
  return row !== undefined;
}

/** Marks the invite of `email` as used, when there is a pending one. */
export async function acceptInvite(db: Db, email: string, now: Date): Promise<void> {
  await db
    .update(invites)
    .set({ acceptedAt: now })
    .where(and(eq(invites.email, email), isNull(invites.acceptedAt)));
}

/** Whether anyone has an account yet (the first account never needs an invite). */
export async function hasAnyUser(db: Db): Promise<boolean> {
  const row = await db.query.users.findFirst({ columns: { id: true } });
  return row !== undefined;
}
