import { useQuery } from "@tanstack/react-query";
import { companiesLeftLabel } from "@/lib/google-quota";
import { providerStatusQuery, systemStatusQuery } from "@/lib/queries";
import { systemSummary } from "@/lib/system-status";

/**
 * Conta → Sistema: the background tasks (refreshed every minute), their one-line summary and
 * today's usage. `now` is the last refresh, so "há 3 min" reads the same on server and client.
 */
export function useSystemOverview() {
  const { data: jobs = [], dataUpdatedAt } = useQuery(systemStatusQuery);
  const { data: status } = useQuery(providerStatusQuery);
  const usage = status
    ? {
        mailSent: status.mail.sentToday,
        mailLimit: status.mail.limit,
        google: companiesLeftLabel(status.placesUsage),
      }
    : null;
  return {
    jobs,
    now: new Date(dataUpdatedAt),
    summary: jobs.length > 0 ? systemSummary(jobs.map((job) => job.state)) : null,
    usage,
  };
}
