import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  CATEGORY_LABELS,
  newUnreadKeys,
  visibleNotifications,
  type NotificationItem,
} from "@/lib/notifications";
import { playNotificationSound, systemPermission } from "@/lib/notification-sound";
import type { NotificationCenter } from "./use-notifications";

function showSystemNotification(item: NotificationItem, open: (item: NotificationItem) => void) {
  const notification = new window.Notification(item.title, {
    body: `${CATEGORY_LABELS[item.category]} · ${item.text}`,
    tag: item.key,
  });
  notification.addEventListener("click", () => {
    window.focus();
    open(item);
    notification.close();
  });
}

/**
 * Sound and system notification for what arrives while the app is open, following each
 * category's preference. The first load only records what is there: nothing old rings.
 * The system notification only shows while the tab is in the background.
 */
export function useNotificationAlerts(center: NotificationCenter | null) {
  const navigate = useNavigate();
  const seen = useRef<Set<string> | null>(null);

  const items = center?.data.items;
  const prefs = center?.data.prefs;
  const userId = center?.data.userId ?? null;
  const markRead = center?.markRead;

  useEffect(() => {
    if (!items || !prefs) return;
    const mine = visibleNotifications(items, prefs, prefs.scope, userId);
    const previous = seen.current;
    seen.current = new Set(mine.filter((item) => item.unread).map((item) => item.key));
    if (!previous) return;

    const fresh = new Set(newUnreadKeys(previous, mine));
    const arrived = mine.filter((item) => fresh.has(item.key));
    if (arrived.length === 0) return;

    if (arrived.some((item) => prefs.categories[item.category].sound)) {
      void playNotificationSound();
    }
    if (!document.hidden || systemPermission() !== "granted") return;
    const open = (item: NotificationItem) => {
      markRead?.([item.key]);
      void navigate(item.href);
    };
    for (const item of arrived.filter((entry) => prefs.categories[entry.category].system)) {
      showSystemNotification(item, open);
    }
  }, [items, prefs, userId, markRead, navigate]);
}
