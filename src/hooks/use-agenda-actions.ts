import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dayMonth, weekdayName } from "@/lib/format";
import type { MeetingInput, MeetingReschedule } from "@/lib/meetings";
import { errorToast } from "@/lib/mutation-toasts";
import { invalidateLeadScreens } from "@/lib/queries";
import { cancelMeeting, rescheduleMeeting, scheduleMeeting } from "@/server/sales";

/** "Qui, 05/11 às 14:00". */
function shortWhen(day: string, time: string): string {
  return `${weekdayName(day).slice(0, 3)}, ${dayMonth(day)} às ${time}`;
}

/** A move on the Agenda: where the meeting goes and where it was, for "Desfazer". */
export type MeetingMove = MeetingReschedule & { from: { day: string; time: string } };

/**
 * What the Agenda changes: book a meeting for a lead, reschedule one (with "Desfazer") and
 * cancel one. Every screen a meeting shows up on is refreshed after each change.
 */
export function useAgendaActions() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      invalidateLeadScreens(queryClient),
      queryClient.invalidateQueries({ queryKey: ["lead"] }),
    ]);

  const book = useMutation({
    mutationFn: (input: MeetingInput) => scheduleMeeting({ data: input }),
    onSuccess: async (result, input) => {
      await refresh();
      toast.success(`Reunião marcada para ${shortWhen(input.day, input.time)}`, {
        description: result.queued ? "O convite entrou na fila de envio." : undefined,
      });
    },
    onError: errorToast("Não foi possível marcar a reunião"),
  });

  const move = useMutation({
    mutationFn: (input: MeetingReschedule) => rescheduleMeeting({ data: input }),
    onError: errorToast("Não foi possível remarcar a reunião"),
  });

  const reschedule = (input: MeetingMove, options?: { onSuccess?: () => void }) =>
    move.mutate(
      { id: input.id, day: input.day, time: input.time },
      {
        onSuccess: async (result) => {
          await refresh();
          options?.onSuccess?.();
          toast.success(`Reunião remarcada para ${shortWhen(input.day, input.time)}`, {
            description: result.inviteCancelled
              ? "O convite que estava na fila tinha o horário antigo e foi cancelado."
              : undefined,
            action: {
              label: "Desfazer",
              onClick: () =>
                move.mutate(
                  { id: input.id, ...input.from },
                  { onSuccess: () => void refresh().then(() => toast("Desfeito")) },
                ),
            },
          });
        },
      },
    );

  const cancel = useMutation({
    mutationFn: (id: string) => cancelMeeting({ data: { id } }),
    onSuccess: async () => {
      await refresh();
      toast("Reunião cancelada");
    },
    onError: errorToast("Não foi possível cancelar a reunião"),
  });

  return {
    book: (input: MeetingInput, options?: { onSuccess?: () => void }) =>
      book.mutate(input, options),
    reschedule,
    cancel: (id: string, options?: { onSuccess?: () => void }) => cancel.mutate(id, options),
    booking: book.isPending,
    moving: move.isPending,
    cancelling: cancel.isPending,
  };
}

export type AgendaActions = ReturnType<typeof useAgendaActions>;
