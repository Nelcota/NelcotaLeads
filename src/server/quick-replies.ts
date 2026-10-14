import { asc } from "drizzle-orm";
import type { Db } from "@/db/client";
import { quickReplies } from "@/db/schema";
import {
  QUICK_REPLY_LIMITS,
  quickRepliesInputSchema,
  quickReplySchema,
  type QuickReplyInput,
} from "@/lib/schemas";

export type StoredQuickReply = QuickReplyInput & { id: string };

/** The saved answers in the user's order; a row that no longer validates is left out. */
export async function loadQuickReplies(db: Db): Promise<StoredQuickReply[]> {
  const rows = await db
    .select()
    .from(quickReplies)
    .orderBy(asc(quickReplies.position))
    .limit(QUICK_REPLY_LIMITS.count);
  return rows.flatMap((row) => {
    const parsed = quickReplySchema.safeParse(row);
    return parsed.success ? [{ id: row.id, ...parsed.data }] : [];
  });
}

/** Replaces the whole list at once (the settings form saves it as one). */
export async function storeQuickReplies(db: Db, replies: QuickReplyInput[]) {
  const list = quickRepliesInputSchema.parse({ replies }).replies;
  await db.batch([
    db.delete(quickReplies),
    ...list.map((reply, position) =>
      db.insert(quickReplies).values({ id: crypto.randomUUID(), ...reply, position }),
    ),
  ]);
}
