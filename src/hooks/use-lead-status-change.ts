import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LeadStatus } from "@/db/schema";
import { errorToast } from "@/lib/mutation-toasts";
import { BULK_LIMIT, type BulkSnapshot, LEAD_STATUS_LABELS } from "@/lib/schemas";
import { bulkUpdateLeads, undoBulkUpdateLeads } from "@/server/leads";

type ChangeInput = { ids: string[]; status: Exclude<LeadStatus, "closed"> };

/** How long "Desfazer" stays on screen after a change. */
const UNDO_MS = 6000;

function countLabel(count: number) {
  return `${count} ${count === 1 ? "lead" : "leads"}`;
}

function doneMessage(status: ChangeInput["status"], changed: number) {
  if (status === "discarded") return `${countLabel(changed)} ${changed === 1 ? "descartado" : "descartados"}`;
  return `${countLabel(changed)} em ${LEAD_STATUS_LABELS[status]}`;
}

/**
 * Moves leads to a status from the list (one row or a selection) and offers "Desfazer" for a
 * few seconds. Shared by the row's "Mudar etapa" and the selection bar.
 */
export function useLeadStatusChange(onDone?: () => void) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["lead"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      // The niche funnel counts leads by status.
      queryClient.invalidateQueries({ queryKey: ["niches"] }),
    ]);

  const undo = async (status: LeadStatus, previous: BulkSnapshot[]) => {
    try {
      await undoBulkUpdateLeads({ data: { status, previous } });
      await refresh();
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };

  return useMutation({
    mutationFn: ({ ids, status }: ChangeInput) =>
      ids.length > BULK_LIMIT
        ? // Refused rather than cut: a partial change would look like the whole selection moved.
          Promise.reject(new Error(`Selecione até ${BULK_LIMIT} leads por vez.`))
        : bulkUpdateLeads({ data: { ids, status } }),
    onSuccess: async (result, { status }) => {
      await refresh();
      onDone?.();
      const skipped =
        result.skipped > 0
          ? `${result.skipped} não ${result.skipped === 1 ? "mudou" : "mudaram"}: a etapa atual não permite.`
          : undefined;
      if (result.changed === 0) {
        toast.error("Nenhum lead mudou", { description: skipped });
        return;
      }
      toast(doneMessage(status, result.changed), {
        description: skipped,
        duration: UNDO_MS,
        action: { label: "Desfazer", onClick: () => void undo(status, result.previous) },
      });
    },
    onError: errorToast("Não foi possível mudar os leads"),
  });
}
