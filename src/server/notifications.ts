import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { markReadSchema, notificationPrefsSchema, notificationsEnabled } from "@/lib/notifications";
import { idSchema } from "@/lib/schemas";
import {
  loadNotificationPrefs,
  loadNotifications,
  markLeadRepliesRead,
  markNotificationsRead,
  storeNotificationPrefs,
} from "./notification-store";
import { requestUserId } from "./request-user";

const SESSION_EXPIRED = "Sessão expirada";

const isEnabled = () => notificationsEnabled(env.NOTIFICATIONS_ENABLED);

async function signedInUser(): Promise<string> {
  const userId = await requestUserId();
  if (!userId) throw new Error(SESSION_EXPIRED);
  return userId;
}

/** The bell: every notification with this person's read marks and preferences. */
export const getNotifications = createServerFn({ method: "GET" }).handler(async () => {
  if (!isEnabled()) return { enabled: false as const };
  const userId = await signedInUser();
  const db = getDb();
  const [items, prefs] = await Promise.all([
    loadNotifications(db, userId),
    loadNotificationPrefs(db, userId),
  ]);
  return { enabled: true as const, userId, now: Date.now(), items, prefs };
});

export type NotificationsData = Awaited<ReturnType<typeof getNotifications>>;

export const markNotificationsReadFn = createServerFn({ method: "POST" })
  .validator(markReadSchema)
  .handler(async ({ data }) => {
    if (!isEnabled()) return { ok: true as const };
    await markNotificationsRead(getDb(), await signedInUser(), data.keys);
    return { ok: true as const };
  });

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .validator(notificationPrefsSchema)
  .handler(async ({ data }) => {
    if (!isEnabled()) return { ok: true as const };
    await storeNotificationPrefs(getDb(), await signedInUser(), data);
    return { ok: true as const };
  });

/**
 * Opening a conversation reads its replies, for the bell and the bold rows in Leads. Recorded
 * even with the bell off (nothing shows it), so turning it on does not resurface handled replies.
 */
export const readLeadReplies = createServerFn({ method: "POST" })
  .validator(z.object({ leadId: idSchema }))
  .handler(async ({ data }) => {
    await signedInUser();
    await markLeadRepliesRead(getDb(), data.leadId);
    return { ok: true as const };
  });
