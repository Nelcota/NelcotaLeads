import { z } from "zod";
import { dayMonth, localDay, relativeDay } from "./format";

/** NOTIFICATIONS_ENABLED: the bell only shows with "true" (or "1"); off by default. */
export function notificationsEnabled(value: string | undefined): boolean {
  const flag = value?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

/** The groups of the notification panel, in the order they show. */
export const NOTIFICATION_CATEGORIES = ["replies", "followUps", "agenda", "searches"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  replies: "Respostas",
  followUps: "Retornos e atrasados",
  agenda: "Agenda",
  searches: "Buscas concluídas",
};

/** Whose notifications reach a person: the leads they own (default) or every lead. */
export const NOTIFICATION_SCOPES = ["mine", "all"] as const;
export type NotificationScope = (typeof NOTIFICATION_SCOPES)[number];

const categoryPrefsSchema = z.object({
  show: z.boolean(),
  sound: z.boolean(),
  system: z.boolean(),
});
export type CategoryPrefs = z.infer<typeof categoryPrefsSchema>;

export const notificationPrefsSchema = z.object({
  scope: z.enum(NOTIFICATION_SCOPES),
  categories: z.object({
    replies: categoryPrefsSchema,
    followUps: categoryPrefsSchema,
    agenda: categoryPrefsSchema,
    searches: categoryPrefsSchema,
  }),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

const QUIET: CategoryPrefs = { show: true, sound: false, system: false };

/** Everything shows; sound and the system notification start off. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  scope: "mine",
  categories: { replies: QUIET, followUps: QUIET, agenda: QUIET, searches: QUIET },
};

/** The stored preferences, or the defaults when none were saved or they no longer parse. */
export function readNotificationPrefs(stored: unknown): NotificationPrefs {
  const parsed = notificationPrefsSchema.safeParse(stored);
  if (!parsed.success) return DEFAULT_NOTIFICATION_PREFS;
  return parsed.data;
}

/**
 * One notification. `key` identifies it for the read mark and changes when the thing it
 * points to changes (a follow-up moved to another day notifies again).
 */
export type NotificationItem = {
  key: string;
  category: NotificationCategory;
  title: string;
  text: string;
  /** A warning shown with the red line icon ("Atrasado 2 dias"). */
  warning: string | null;
  /** When it happened (or became due), for the order and the "há 5 min" label. */
  at: number;
  /** Something ahead (a meeting): the label counts down to it instead ("em 10 min"). */
  dueAt: number | null;
  /** A day-only date (a follow-up): the label is that day ("hoje", "há 3 dias", 12/10). */
  day: string | null;
  /** The person it belongs to; null reaches the whole team (lead without owner, searches). */
  ownerId: string | null;
  ownerName: string | null;
  unread: boolean;
  href: NotificationHref;
};

/** Where clicking a notification goes: a route of the app with its search params. */
export type NotificationHref =
  | { to: "/conversas"; search: { lead: string } }
  | { to: "/leads"; search: { view: "all"; lead: string } }
  | { to: "/agenda"; search: { view: "dia"; date: string } }
  | { to: "/searches/$searchId"; params: { searchId: string } };

/** Whether a notification reaches the person under their scope. */
export function isForMe(item: NotificationItem, scope: NotificationScope, userId: string | null) {
  if (scope === "all") return true;
  if (item.ownerId === null) return true;
  return item.ownerId === userId;
}

/** The notifications a person sees: the shown categories, within the scope, newest first. */
export function visibleNotifications(
  items: readonly NotificationItem[],
  prefs: NotificationPrefs,
  scope: NotificationScope,
  userId: string | null,
): NotificationItem[] {
  return items
    .filter((item) => prefs.categories[item.category].show)
    .filter((item) => isForMe(item, scope, userId))
    .toSorted((a, b) => b.at - a.at);
}

export type NotificationSection = { label: "Novas" | "Anteriores"; items: NotificationItem[] };

/**
 * The panel: one list ordered by time, split only into unread ("Novas") and read ("Anteriores");
 * the colored icon of each row tells the type. Empty sections are left out.
 */
export function splitNotifications(items: readonly NotificationItem[]): NotificationSection[] {
  const sections: NotificationSection[] = [
    { label: "Novas", items: items.filter((item) => item.unread) },
    { label: "Anteriores", items: items.filter((item) => !item.unread) },
  ];
  return sections.filter((section) => section.items.length > 0);
}

/** The bell's number: "9+" past nine, nothing at zero. */
export function unreadBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" or dd/mm, for a past instant. */
export function sinceLabel(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days <= 6) return `há ${days} dias`;
  return dayMonth(localDay(new Date(at)));
}

/** "em 10 min", "em 2 h", or "começou" once the time passed, for an instant ahead. */
export function untilLabel(at: number, now: number): string {
  const minutes = Math.ceil((at - now) / 60_000);
  if (minutes <= 0) return "começou";
  if (minutes < 60) return `em ${minutes} min`;
  return `em ${Math.round(minutes / 60)} h`;
}

/** The time label of a row: the day of a follow-up, a countdown to a meeting, else how long ago. */
export function whenLabel(item: NotificationItem, now: number): string {
  if (item.day) return relativeDay(item.day, localDay(new Date(now)));
  if (item.dueAt !== null) return untilLabel(item.dueAt, now);
  return sinceLabel(item.at, now);
}

/** Keys that are new since the last look: unread now and not in the previous set. */
export function newUnreadKeys(previous: ReadonlySet<string>, items: readonly NotificationItem[]) {
  return items.filter((item) => item.unread && !previous.has(item.key)).map((item) => item.key);
}

/** The read mark of a reply lives on the e-mail; every other one in notification_reads. */
export const REPLY_KEY_PREFIX = "reply:";

const keyList = z.array(z.string().min(1).max(160)).max(200);

/** The keys a read or clear action applies to. */
export const notificationKeysSchema = z.object({ keys: keyList.min(1) });

/** "Desfazer": the cleared keys, and which of them were unread before clearing. */
export const restoreKeysSchema = z.object({ keys: keyList.min(1), unreadKeys: keyList });
