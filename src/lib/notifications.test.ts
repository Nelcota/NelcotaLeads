import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  groupNotifications,
  isForMe,
  newUnreadKeys,
  notificationsEnabled,
  readNotificationPrefs,
  sinceLabel,
  unreadBadge,
  untilLabel,
  visibleNotifications,
  whenLabel,
  type NotificationItem,
} from "./notifications";

const NOW = Date.parse("2026-11-07T15:00:00Z");
const MINUTE = 60_000;

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    key: "reply:e1",
    category: "replies",
    title: "Odonto Sorriso BH",
    text: "“Pode me mandar valores?”",
    warning: null,
    at: NOW - 5 * MINUTE,
    dueAt: null,
    day: null,
    ownerId: "haniel",
    ownerName: "Haniel",
    unread: true,
    href: { to: "/conversas", search: { lead: "l1" } },
    ...overrides,
  };
}

describe("notificationsEnabled", () => {
  it("is on only with true or 1", () => {
    expect(notificationsEnabled("true")).toBe(true);
    expect(notificationsEnabled(" 1 ")).toBe(true);
    expect(notificationsEnabled("false")).toBe(false);
    expect(notificationsEnabled(undefined)).toBe(false);
  });
});

describe("readNotificationPrefs", () => {
  it("falls back to the defaults when nothing valid was saved", () => {
    expect(readNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(readNotificationPrefs({ scope: "everyone" })).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });

  it("starts with sound and the system notification off", () => {
    for (const prefs of Object.values(DEFAULT_NOTIFICATION_PREFS.categories)) {
      expect(prefs).toEqual({ show: true, sound: false, system: false });
    }
    expect(DEFAULT_NOTIFICATION_PREFS.scope).toBe("mine");
  });
});

describe("isForMe", () => {
  it("keeps my leads and leads without owner under 'mine'", () => {
    expect(isForMe(item({ ownerId: "haniel" }), "mine", "haniel")).toBe(true);
    expect(isForMe(item({ ownerId: null }), "mine", "haniel")).toBe(true);
    expect(isForMe(item({ ownerId: "phellipe" }), "mine", "haniel")).toBe(false);
    expect(isForMe(item({ ownerId: "phellipe" }), "all", "haniel")).toBe(true);
  });
});

describe("visibleNotifications", () => {
  it("drops hidden categories and orders newest first", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      categories: {
        ...DEFAULT_NOTIFICATION_PREFS.categories,
        searches: { show: false, sound: false, system: false },
      },
    };
    const older = item({ key: "reply:old", at: NOW - 60 * MINUTE });
    const newer = item({ key: "reply:new", at: NOW - MINUTE });
    const search = item({ key: "search:s1", category: "searches", ownerId: null });
    const shown = visibleNotifications([older, search, newer], prefs, "mine", "haniel");
    expect(shown.map((entry) => entry.key)).toEqual(["reply:new", "reply:old"]);
  });
});

describe("groupNotifications", () => {
  it("follows the fixed category order and lists the unread keys", () => {
    const groups = groupNotifications([
      item({ key: "search:s1", category: "searches" }),
      item({ key: "reply:a", unread: false }),
      item({ key: "reply:b" }),
    ]);
    expect(groups.map((group) => group.category)).toEqual(["replies", "searches"]);
    expect(groups[0]?.unreadKeys).toEqual(["reply:b"]);
    expect(groups[0]?.label).toBe("Respostas");
  });
});

describe("labels", () => {
  it("caps the bell at 9+ and shows nothing at zero", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(4)).toBe("4");
    expect(unreadBadge(12)).toBe("9+");
  });

  it("says how long ago", () => {
    expect(sinceLabel(NOW - 20_000, NOW)).toBe("agora");
    expect(sinceLabel(NOW - 5 * MINUTE, NOW)).toBe("há 5 min");
    expect(sinceLabel(NOW - 3 * 60 * MINUTE, NOW)).toBe("há 3 h");
    expect(sinceLabel(NOW - 30 * 60 * MINUTE, NOW)).toBe("ontem");
    expect(sinceLabel(Date.parse("2026-10-12T15:00:00Z"), NOW)).toBe("12/10");
  });

  it("counts down to a meeting", () => {
    expect(untilLabel(NOW + 10 * MINUTE, NOW)).toBe("em 10 min");
    expect(untilLabel(NOW + 110 * MINUTE, NOW)).toBe("em 2 h");
    expect(untilLabel(NOW - MINUTE, NOW)).toBe("começou");
  });

  it("uses the day for follow-ups and the countdown for meetings", () => {
    expect(whenLabel(item({ day: "2026-11-07" }), NOW)).toBe("hoje");
    expect(whenLabel(item({ dueAt: NOW + 10 * MINUTE }), NOW)).toBe("em 10 min");
    expect(whenLabel(item(), NOW)).toBe("há 5 min");
  });
});

describe("newUnreadKeys", () => {
  it("returns only unread keys that were not there before", () => {
    const items = [item({ key: "a" }), item({ key: "b" }), item({ key: "c", unread: false })];
    expect(newUnreadKeys(new Set(["a"]), items)).toEqual(["b"]);
  });
});
