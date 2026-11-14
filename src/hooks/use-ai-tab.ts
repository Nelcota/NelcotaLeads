import { minScoreImpact } from "@/lib/settings-overview";
import { useAiSettingsForm } from "./use-ai-settings-form";
import { useSettingsOverview } from "./use-settings-overview";

/**
 * Configurações → IA e pontuação: the settings form plus what the minimum score being typed
 * would leave out among the leads already analyzed.
 */
export function useAiTab() {
  const state = useAiSettingsForm();
  const { overview } = useSettingsOverview();
  const minScore = Number.isFinite(state.minScore) ? state.minScore : state.defaults.minScore;
  const impact = overview ? minScoreImpact(overview.scoreCounts, minScore) : null;
  return { state, impact, minScore };
}
