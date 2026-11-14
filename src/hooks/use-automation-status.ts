import { localDay, localTime } from "@/lib/format";
import { lastDailySearch, nextDailySearch } from "@/lib/settings-overview";
import { timeAgo, type Job } from "@/lib/system-status";
import { useSettingsOverview } from "./use-settings-overview";
import { useSystemOverview } from "./use-system-overview";

/**
 * The line under each automation switch: when it last ran and, for the daily search, when it
 * runs next. Read from the background tasks (`job_runs`) and the last daily search day.
 */
export function useAutomationStatus(daily: { enabled: boolean; hour: number; targets: number }) {
  const { overview } = useSettingsOverview();
  const system = useSystemOverview();
  const today = localDay(system.now);
  const nowHour = Number(localTime(system.now).slice(0, 2));

  const ranAgo = (job: Job) => {
    const run = system.jobs.find((row) => row.job === job)?.lastRunAt;
    return run ? `Rodou ${timeAgo(new Date(run), system.now)}.` : null;
  };

  const lastRunOn = overview?.dailySearchLastRunOn ?? null;
  const last = lastDailySearch(lastRunOn, today);
  const next = nextDailySearch({ ...daily, lastRunOn }, today, nowHour);
  const dailyParts = [last ? `Última: ${last}.` : null, next ? `Próxima: ${next.toLowerCase()}.` : null];

  return {
    dailySearch: dailyParts.filter(Boolean).join(" ") || null,
    autoDispatch: ranAgo("auto-dispatch"),
    aiAutoReply: ranAgo("inbox"),
  };
}
