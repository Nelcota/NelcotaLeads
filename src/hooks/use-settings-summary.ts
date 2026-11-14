import { useQuery } from "@tanstack/react-query";
import { localDay, localTime } from "@/lib/format";
import { COMPANIES_PER_GOOGLE_REQUEST } from "@/lib/google-quota";
import {
  autopilotQuery,
  providerStatusQuery,
  quickRepliesQuery,
  sendWindowQuery,
  serviceTableQuery,
  settingsQuery,
} from "@/lib/queries";
import { TONE_LABELS } from "@/lib/schemas";
import { nextDailySearch } from "@/lib/settings-overview";
import { useSettingsOverview } from "./use-settings-overview";
import { useSystemOverview } from "./use-system-overview";

/**
 * Everything the Resumo tab shows, read from the queries the other tabs already use. Each part
 * is `null` while it loads, so a card shows its own placeholder instead of holding the page.
 */
export function useSettingsSummary() {
  const { data: status } = useQuery(providerStatusQuery);
  const { data: window } = useQuery(sendWindowQuery);
  const { data: autopilot } = useQuery(autopilotQuery);
  const { data: settings } = useQuery(settingsQuery);
  const { data: replies } = useQuery(quickRepliesQuery);
  const { data: table } = useQuery(serviceTableQuery);
  const { overview } = useSettingsOverview();
  const system = useSystemOverview();
  const now = new Date();
  const today = localDay(now);
  const nowHour = Number(localTime(now).slice(0, 2));

  const mail = status ? { ...status.mail, window: window ?? null } : null;
  const automation =
    autopilot && overview
      ? {
          aiAutoReply: autopilot.aiAutoReply,
          autoDispatch: autopilot.autoDispatch,
          nextSearch: nextDailySearch(
            {
              enabled: autopilot.enabled,
              hour: autopilot.hour,
              targets: autopilot.targets.length,
              lastRunOn: overview.dailySearchLastRunOn,
            },
            today,
            nowHour,
          ),
        }
      : null;
  const ai = settings
    ? {
        minScore: settings.minScore,
        tone: TONE_LABELS[settings.tone],
        criteria: settings.criteria.length,
      }
    : null;
  const templates = {
    replies: replies?.length ?? null,
    services: table?.services.length ?? null,
    addons: table?.addons.length ?? null,
  };
  const usage = status
    ? {
        mailSent: status.mail.sentToday,
        mailLimit: status.mail.limit,
        companiesUsed: status.placesUsage.used * COMPANIES_PER_GOOGLE_REQUEST,
        companiesLimit: status.placesUsage.limit * COMPANIES_PER_GOOGLE_REQUEST,
        aiMonthUsd: overview?.aiMonthUsd ?? null,
      }
    : null;

  return { mail, automation, ai, templates, usage, system: system.summary };
}

export type SettingsSummary = ReturnType<typeof useSettingsSummary>;
