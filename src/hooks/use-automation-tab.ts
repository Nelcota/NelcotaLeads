import { useQuery } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";
import { providerStatusQuery, sendWindowQuery, settingsQuery } from "@/lib/queries";
import { DEFAULT_MAIL_DAILY_LIMIT, SEND_GAP_MINUTES } from "@/lib/schemas";
import { AI_REPLY_LIMIT } from "@/lib/settings-overview";
import { DEFAULT_FOLLOW_UP_DAYS } from "@/server/lead-status";
import { useAutomationStatus } from "./use-automation-status";
import { useAutopilotForm } from "./use-autopilot-form";

/**
 * Configurações → Automação: the switches and daily search form, the line under each switch,
 * and the values "Num dia comum" reads (it follows the form while you edit).
 */
export function useAutomationTab() {
  const state = useAutopilotForm();
  const live = useWatch({ control: state.form.control });
  const { data: settings } = useQuery(settingsQuery);
  const { data: window } = useQuery(sendWindowQuery);
  const { data: status } = useQuery(providerStatusQuery);
  const targets = (live.targets ?? []).filter((target) => target?.niche?.trim()).length;
  const enabled = live.enabled ?? false;
  const hour = live.hour ?? 8;
  const lines = useAutomationStatus({ enabled, hour, targets });

  return {
    state,
    lines: { enabled: lines.dailySearch, autoDispatch: lines.autoDispatch, aiAutoReply: lines.aiAutoReply },
    timeline: {
      dailySearch: enabled && targets > 0,
      hour,
      results: live.results ?? 20,
      targets,
      minScore: settings?.minScore ?? 0,
      autoDispatch: live.autoDispatch ?? false,
      window: window ?? { start: 6, end: 18 },
      dailyLimit: status?.mail.limit ?? DEFAULT_MAIL_DAILY_LIMIT,
      gapMinutes: SEND_GAP_MINUTES,
      aiAutoReply: live.aiAutoReply ?? false,
      aiReplyLimit: AI_REPLY_LIMIT,
      followUpDays: DEFAULT_FOLLOW_UP_DAYS,
    },
  };
}
