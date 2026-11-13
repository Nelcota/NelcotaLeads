import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { invalidateLeadScreens } from "@/lib/queries";
import type { LeadAssignment } from "@/lib/schemas";
import { ASSIGN_LIMIT } from "@/lib/schemas";
import { undoAssignments } from "@/lib/team-split";
import { assignTeamLeads, splitFreeLeads } from "@/server/team-leads";

/** "Pegar" (`self`) or "Entregar a" one free lead; the names only go into the toast. */
type AssignInput = {
  leadId: string;
  ownerId: string;
  leadName: string;
  ownerName: string;
  self: boolean;
};

/** "Desfazer" stays 10 s: handing out moves someone else's work (decided 2026-11-09). */
const UNDO_MS = 10_000;

function movedText(count: number): string {
  if (count === 0) return "Nenhum lead mudou: alguém já tinha pegado.";
  return count === 1 ? "1 lead dividido" : `${count} leads divididos entre os sócios`;
}

/** "Entregar a" one free lead, "Dividir igualmente" all of them, and "Desfazer" for both. */
export function useLeadAssign() {
  const queryClient = useQueryClient();
  const refresh = () => invalidateLeadScreens(queryClient);

  const undo = useMutation({
    mutationFn: async (moved: LeadAssignment[]) => {
      const assignments = undoAssignments(moved);
      for (let start = 0; start < assignments.length; start += ASSIGN_LIMIT) {
        await assignTeamLeads({
          data: { assignments: assignments.slice(start, start + ASSIGN_LIMIT) },
        });
      }
    },
    onSuccess: async () => {
      await refresh();
      toast("Desfeito");
    },
    onError: errorToast("Não foi possível desfazer"),
  });

  const offerUndo = (text: string, moved: LeadAssignment[]) => {
    if (moved.length === 0) {
      toast(text);
      return;
    }
    toast(text, {
      duration: UNDO_MS,
      action: { label: "Desfazer", onClick: () => undo.mutate(moved) },
    });
  };

  const assign = useMutation({
    mutationFn: (input: AssignInput) =>
      assignTeamLeads({ data: { assignments: [{ id: input.leadId, owner: input.ownerId, expected: null }] } }),
    onSuccess: async (result, input) => {
      await refresh();
      const handed = input.self
        ? `Você pegou ${input.leadName}`
        : `${input.leadName} entregue a ${input.ownerName}`;
      const text = result.moved.length > 0 ? handed : `${input.leadName} já tinha dono`;
      offerUndo(text, result.moved);
    },
    onError: errorToast("Não foi possível entregar o lead"),
  });

  const split = useMutation({
    mutationFn: () => splitFreeLeads(),
    onSuccess: async (result) => {
      await refresh();
      offerUndo(movedText(result.moved.length), result.moved);
    },
    onError: errorToast("Não foi possível dividir os leads"),
  });

  return {
    assign: assign.mutate,
    assigningId: (assign.isPending ? assign.variables?.leadId : null) ?? null,
    // `onDone` runs only when the split went through, so a failure keeps the preview open.
    split: (onDone?: () => void) => split.mutate(undefined, { onSuccess: () => onDone?.() }),
    splitting: split.isPending,
  };
}
