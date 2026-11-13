import { useQuery } from "@tanstack/react-query";
import { teamMembersQuery } from "@/lib/queries";

/** A partner's name from their id, for the owner chips; "pessoa removida" when not found. */
export function useMemberName(id: string): string {
  const { data } = useQuery(teamMembersQuery);
  return data?.find((member) => member.id === id)?.name ?? "pessoa removida";
}
