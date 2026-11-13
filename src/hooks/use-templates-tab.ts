import { useQuery } from "@tanstack/react-query";
import { quickRepliesQuery, serviceTableQuery } from "@/lib/queries";

/** Configurações → Modelos e serviços: the quick replies to edit and the service table to show. */
export function useTemplatesTab() {
  const replies = useQuery(quickRepliesQuery);
  const table = useQuery(serviceTableQuery);
  return {
    replies: replies.data?.map(({ title, body }) => ({ title, body })) ?? null,
    repliesFailed: replies.isError,
    table: table.data ?? null,
    tableFailed: table.isError,
  };
}
