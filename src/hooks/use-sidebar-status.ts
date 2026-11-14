import { useQuery } from "@tanstack/react-query";
import { providerStatusQuery } from "@/lib/queries";
import { sidebarStatus } from "@/lib/sidebar-status";

/** The provider status for the sidebar: the raw data, its summary and a way to try again. */
export function useSidebarStatus() {
  const { data, isError, isFetching, refetch } = useQuery(providerStatusQuery);
  const retry = async () => {
    await refetch();
  };
  return { data, status: sidebarStatus(data, isError), retrying: isFetching, retry };
}
