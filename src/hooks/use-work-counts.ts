import { useQuery } from "@tanstack/react-query";
import { attentionQuery, todayAgendaQuery } from "@/lib/queries";

/**
 * The numbers on Conta's work shortcuts, from the same reads as the sidebar badges: the
 * conversations that need someone and the person's own meetings and follow-ups today. Null while
 * a number is unknown (loading or failed), so the block never claims "nothing" by mistake.
 */
export function useWorkCounts(userId: string | null) {
  const { data: attention } = useQuery(attentionQuery);
  const { data: agenda } = useQuery(todayAgendaQuery);
  const myToday =
    userId && agenda ? agenda.entries.filter((entry) => entry.ownerId === userId).length : null;
  return { attention: attention ?? null, myToday };
}
