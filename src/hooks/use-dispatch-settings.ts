import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coldRoomSummary } from "@/lib/dispatch-review";
import { errorToast } from "@/lib/mutation-toasts";
import { autopilotQuery, coldRoomQuery, providerStatusQuery } from "@/lib/queries";
import { setAutomation } from "@/server/dashboard";

/**
 * What surrounds a dispatch review: the connected mailbox, today's room for first e-mails and
 * the global "IA responde sozinha" switch shown in the sheet's footer.
 */
export function useDispatchSettings(draftCount: number) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery(providerStatusQuery);
  const { data: automationSettings } = useQuery(autopilotQuery);
  const coldRoom = useQuery(coldRoomQuery);

  const automation = useMutation({
    mutationFn: (aiAutoReply: boolean) => setAutomation({ data: { aiAutoReply } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["autopilot"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
    onError: errorToast("Não foi possível mudar a resposta automática"),
  });

  return {
    mail: status?.mail,
    // First e-mails stop at the cold limit (the rest is kept for replies), after those queued.
    room: coldRoomSummary(coldRoom.data, draftCount),
    roomLoading: coldRoom.isPending,
    aiAutoReply: automation.isPending
      ? automation.variables
      : (automationSettings?.aiAutoReply ?? true),
    aiAutoReplyChanging: automation.isPending,
    setAiAutoReply: (checked: boolean) => automation.mutate(checked),
  };
}
