import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSettingsOverview } from "@/server/settings-overview";

/** Configurações' read-only extras: AI spend this month, leads per score, unsubscribed leads. */
export const settingsOverviewQuery = queryOptions({
  queryKey: ["settings-overview"],
  queryFn: () => getSettingsOverview(),
});

/** The extras for the Configurações tabs; `null` while they load or when they failed. */
export function useSettingsOverview() {
  const { data, isError } = useQuery(settingsOverviewQuery);
  return { overview: data ?? null, failed: isError };
}
