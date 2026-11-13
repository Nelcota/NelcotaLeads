import { useQuery } from "@tanstack/react-query";
import { accountQuery } from "@/lib/queries";

/** The signed-in person as Conta shows them; "Sem nome" when the name is empty. */
export function useAccount() {
  const { data: account } = useQuery(accountQuery);
  return {
    userId: account?.id ?? null,
    name: account?.name?.trim() || "Sem nome",
    email: account?.email ?? null,
    avatar: account?.avatar ?? null,
    joinedAt: account?.createdAt ?? null,
  };
}
