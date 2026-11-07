import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { errorToast } from "@/lib/mutation-toasts";
import {
  groupNotifications,
  visibleNotifications,
  type NotificationItem,
  type NotificationPrefs,
  type NotificationScope,
} from "@/lib/notifications";
import { notificationsQuery } from "@/lib/queries";
import {
  markNotificationsReadFn,
  saveNotificationPrefs,
  type NotificationsData,
} from "@/server/notifications";

type Enabled = Extract<NotificationsData, { enabled: true }>;

function withRead(data: NotificationsData | undefined, keys: ReadonlySet<string>) {
  if (!data?.enabled) return data;
  const items = data.items.map((item) => (keys.has(item.key) ? { ...item, unread: false } : item));
  return { ...data, items };
}

function withPrefs(data: NotificationsData | undefined, prefs: NotificationPrefs) {
  if (!data?.enabled) return data;
  return { ...data, prefs };
}

/** Marks notifications read at once on screen, then on the server; undone if the save fails. */
function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) => markNotificationsReadFn({ data: { keys } }),
    onMutate: async (keys) => {
      await queryClient.cancelQueries({ queryKey: notificationsQuery.queryKey });
      const previous = queryClient.getQueryData(notificationsQuery.queryKey);
      queryClient.setQueryData(notificationsQuery.queryKey, withRead(previous, new Set(keys)));
      return { previous };
    },
    onError: (error, _keys, context) => {
      queryClient.setQueryData(notificationsQuery.queryKey, context?.previous);
      errorToast("Não foi possível marcar como lida")(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsQuery.queryKey }),
  });
}

/** Saves the preferences, shown at once; undone if the save fails. */
function useSavePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) => saveNotificationPrefs({ data: prefs }),
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: notificationsQuery.queryKey });
      const previous = queryClient.getQueryData(notificationsQuery.queryKey);
      queryClient.setQueryData(notificationsQuery.queryKey, withPrefs(previous, prefs));
      return { previous };
    },
    onError: (error, _prefs, context) => {
      queryClient.setQueryData(notificationsQuery.queryKey, context?.previous);
      errorToast("Não foi possível salvar as preferências")(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsQuery.queryKey }),
  });
}

export type NotificationCenter = {
  data: Enabled;
  /** What the bell counts: unread, in the shown categories, within the saved scope. */
  unreadCount: number;
  /** The panel's filter ("Meus leads" / "Todos"); starts at the saved scope. */
  filter: NotificationScope;
  setFilter: (scope: NotificationScope) => void;
  groups: ReturnType<typeof groupNotifications>;
  markRead: (keys: string[]) => void;
  savePrefs: (prefs: NotificationPrefs) => void;
};

/**
 * The notification center's state: the items, the bell count, the panel filter and the
 * actions. Null while loading, on error or with NOTIFICATIONS_ENABLED off (no bell at all).
 */
export function useNotifications(): NotificationCenter | null {
  const { data } = useQuery(notificationsQuery);
  const [filterChoice, setFilter] = useState<NotificationScope | null>(null);
  const markRead = useMarkRead();
  const savePrefs = useSavePrefs();

  const enabled = data?.enabled ? data : null;
  const filter = filterChoice ?? enabled?.prefs.scope ?? "mine";

  const derived = useMemo(() => {
    if (!enabled) return null;
    const mine = visibleNotifications(enabled.items, enabled.prefs, enabled.prefs.scope, enabled.userId);
    const shown = visibleNotifications(enabled.items, enabled.prefs, filter, enabled.userId);
    return {
      unreadCount: mine.filter((item: NotificationItem) => item.unread).length,
      groups: groupNotifications(shown),
    };
  }, [enabled, filter]);

  if (!enabled || !derived) return null;
  return {
    data: enabled,
    unreadCount: derived.unreadCount,
    filter,
    setFilter,
    groups: derived.groups,
    markRead: (keys) => {
      if (keys.length === 0) return;
      markRead.mutate(keys);
    },
    savePrefs: (prefs) => {
      setFilter(null);
      savePrefs.mutate(prefs);
    },
  };
}
