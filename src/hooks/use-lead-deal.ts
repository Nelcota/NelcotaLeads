import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LeadStatus } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { errorToast } from "@/lib/mutation-toasts";
import type { LostDeal, WonDeal } from "@/lib/deal-form";
import { invalidateLeadScreens } from "@/lib/queries";
import type { SalesStage } from "@/lib/schemas";
import type { CloseSnapshot } from "@/server/conversation";
import { closeLost, closeWon, setOwner, setSalesStage } from "@/server/leads";
import { undoCloseConversation } from "@/server/mail";

type MutateOptions = { onSuccess?: () => void };

/**
 * The deal actions of a lead (its panel and Conversas): close won or lost, move the sale's
 * stage, take or free the lead. `onChanged` refreshes the caller's own screens (every screen a
 * lead shows up on is refreshed here too); `onStatusChanged` lets the list move on. `beforeClose`
 * runs first (Conversas saves the reply being typed, so undo brings it back with the rest).
 */
export function useLeadDeal(
  leadId: string,
  {
    onChanged,
    onStatusChanged,
    beforeClose,
  }: {
    onChanged: () => Promise<unknown>;
    onStatusChanged?: (status: LeadStatus) => void;
    beforeClose?: () => Promise<unknown>;
  },
) {
  const queryClient = useQueryClient();
  const changed = () => Promise.all([onChanged(), invalidateLeadScreens(queryClient)]);
  // Runs from the toast, which may outlive the panel (the user opened another lead).
  const undo = async (snapshot: CloseSnapshot) => {
    try {
      await undoCloseConversation({ data: { leadId, ...snapshot } });
      await changed();
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };
  const undoAction = (snapshot: CloseSnapshot) => ({
    label: "Desfazer",
    onClick: () => void undo(snapshot),
  });

  const won = useMutation({
    mutationFn: async (deal: WonDeal) => {
      await beforeClose?.();
      return closeWon({ data: { id: leadId, ...deal } });
    },
    onSuccess: async (result, deal) => {
      await changed();
      toast.success(`Negócio fechado: ${formatCents(deal.valueCents)}`, {
        duration: 6000,
        action: undoAction(result.snapshot),
      });
      onStatusChanged?.("closed");
    },
    onError: errorToast("Não foi possível fechar o negócio"),
  });
  const lost = useMutation({
    mutationFn: async (deal: LostDeal) => {
      await beforeClose?.();
      return closeLost({ data: { id: leadId, ...deal } });
    },
    onSuccess: async (result, deal) => {
      await changed();
      // An opt-out cannot be undone (the lead asked not to be contacted).
      toast("Lead encerrado sem negócio", {
        duration: 6000,
        action: deal.reason === "asked_no_contact" ? undefined : undoAction(result.snapshot),
      });
      onStatusChanged?.("discarded");
    },
    onError: errorToast("Não foi possível encerrar o lead"),
  });
  const stage = useMutation({
    mutationFn: (next: SalesStage | null) => setSalesStage({ data: { id: leadId, stage: next } }),
    onSuccess: changed,
    onError: errorToast("Não foi possível mudar a etapa"),
  });
  const owner = useMutation({
    mutationFn: (next: "me" | null) => setOwner({ data: { id: leadId, owner: next } }),
    onSuccess: changed,
    onError: errorToast("Não foi possível mudar o responsável"),
  });
  return {
    closeWon: (deal: WonDeal, options?: MutateOptions) => won.mutate(deal, options),
    closeLost: (deal: LostDeal, options?: MutateOptions) => lost.mutate(deal, options),
    setStage: (next: SalesStage | null) => stage.mutate(next),
    take: () => owner.mutate("me"),
    release: () => owner.mutate(null),
    closing: won.isPending || lost.isPending,
    movingStage: stage.isPending,
    changingOwner: owner.isPending,
  };
}

export type LeadDeal = ReturnType<typeof useLeadDeal>;
