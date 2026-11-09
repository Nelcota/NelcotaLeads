import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LeadStatus } from "@/db/schema";
import { errorToast } from "@/lib/mutation-toasts";
import { invalidateLeadScreens } from "@/lib/queries";
import { BULK_LIMIT, type BulkSnapshot, LEAD_STATUS_LABELS } from "@/lib/schemas";
import type { BulkResult } from "@/server/lead-bulk";
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

/** Why the rest did not move, one reason at a time; nothing when every lead changed. */
function skippedLine(result: BulkResult, status: ChangeInput["status"]): string | undefined {
  const parts: string[] = [];
  const { alreadyThere, notAllowed, needsReason, changedMeanwhile, gone } = result;
  if (alreadyThere > 0) {
    const where = status === "discarded" ? "descartado" : `em ${LEAD_STATUS_LABELS[status]}`;
    parts.push(`${alreadyThere} já ${alreadyThere === 1 ? "estava" : "estavam"} ${where}`);
  }
  if (notAllowed > 0) {
    parts.push(
      `${notAllowed} não ${notAllowed === 1 ? "mudou" : "mudaram"}: a etapa atual não permite`,
    );
  }
  if (needsReason > 0) {
    parts.push(
      `${needsReason} em conversa: encerre pelo painel, com o motivo`,
    );
  }
  if (changedMeanwhile > 0) {
    parts.push(
      `${changedMeanwhile} ${changedMeanwhile === 1 ? "mudou" : "mudaram"} de etapa enquanto isso`,
    );
  }
  if (gone > 0) parts.push(`${gone} não ${gone === 1 ? "existe" : "existem"} mais`);
  return parts.length > 0 ? `${parts.join(" · ")}.` : undefined;
}

/**
 * Moves leads to a status from the list (one row or a selection) and offers "Desfazer" for a
 * few seconds. Shared by the row's "Mudar etapa" and the selection bar.
 */
export function useLeadStatusChange(onDone?: () => void) {
  const queryClient = useQueryClient();
  // Every screen that reads leads (agenda, conversations, bell, metrics) plus the open panel.
  const refresh = () =>
    Promise.all([
      invalidateLeadScreens(queryClient),
      queryClient.invalidateQueries({ queryKey: ["lead"] }),
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
      const skipped = skippedLine(result, status);
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
