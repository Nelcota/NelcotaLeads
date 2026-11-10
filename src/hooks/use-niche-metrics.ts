import { useQuery } from "@tanstack/react-query";
import type { OverviewPeriod } from "@/lib/period";
import { nicheMetricsQuery } from "@/lib/queries";

/** "Por nicho": every niche with activity in the period, with loading and error states. */
export function useNicheMetrics(period: OverviewPeriod) {
  const { data, isPending, isError } = useQuery(nicheMetricsQuery(period));
  return { niches: data ?? [], loading: isPending, error: isError };
}
