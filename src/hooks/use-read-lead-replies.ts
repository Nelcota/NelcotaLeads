import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { notificationsQuery } from "@/lib/queries";
import { readLeadReplies } from "@/server/notifications";

type Message = { direction: "in" | "out"; automatic: boolean; readAt: Date | null };

/** Whether the thread has a reply from the lead nobody opened yet. */
export function hasUnreadReply(messages: readonly Message[] | undefined): boolean {
  if (!messages) return false;
  return messages.some((message) => message.direction === "in" && !message.automatic && !message.readAt);
}

/**
 * Showing a lead's conversation reads its replies: the bell and the bold rows in Leads clear
 * for the whole team. Runs once per thread while it has an unread reply.
 */
export function useReadLeadReplies(leadId: string, messages: readonly Message[] | undefined) {
  const queryClient = useQueryClient();
  const unread = hasUnreadReply(messages);
  const { mutate } = useMutation({
    mutationFn: () => readLeadReplies({ data: { leadId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQuery.queryKey }),
  });

  useEffect(() => {
    if (!unread) return;
    mutate();
  }, [leadId, unread, mutate]);
}
