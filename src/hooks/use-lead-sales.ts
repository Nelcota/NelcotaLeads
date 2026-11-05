import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import type { MeetingDraft } from "@/lib/meetings";
import type { ProposalDraft } from "@/lib/proposal";
import { invalidateLeadScreens, leadSalesQuery, serviceTableQuery } from "@/lib/queries";
import type { EmailText } from "@/lib/sales-email";
import { cancelMeeting, saveProposal, scheduleMeeting } from "@/server/sales";

async function copyText(text: EmailText) {
  try {
    await navigator.clipboard.writeText(`${text.subject}\n\n${text.body}`);
    toast.success("Texto copiado");
  } catch {
    toast.error("Não foi possível copiar");
  }
}

/** The toast after saving: "na fila" when it was e-mailed, else a way to copy the text. */
function savedToast(title: string, result: { queued: boolean; email: EmailText }) {
  if (result.queued) {
    toast.success(title, { description: "O e-mail entrou na fila de envio." });
    return;
  }
  toast.success(title, {
    description: "Não foi por e-mail. Copie o texto e mande pelo canal da conversa.",
    action: { label: "Copiar texto", onClick: () => void copyText(result.email) },
  });
}

/**
 * The lead panel's meetings and proposals: the lead's upcoming meetings, its latest proposal,
 * the service table and whether e-mails can go out; schedule, cancel and propose.
 * `onChanged` refreshes the caller's screens; every screen a lead shows up on is refreshed here.
 */
export function useLeadSales(leadId: string, { onChanged }: { onChanged: () => Promise<unknown> }) {
  const queryClient = useQueryClient();
  const sales = useQuery(leadSalesQuery(leadId));
  const table = useQuery(serviceTableQuery);
  const refresh = () =>
    Promise.all([
      onChanged(),
      queryClient.invalidateQueries({ queryKey: leadSalesQuery(leadId).queryKey }),
      invalidateLeadScreens(queryClient),
    ]);

  const schedule = useMutation({
    mutationFn: (draft: MeetingDraft) => scheduleMeeting({ data: { leadId, ...draft } }),
    onSuccess: async (result) => {
      await refresh();
      savedToast("Reunião marcada", { queued: result.queued, email: result.invite });
    },
    onError: errorToast("Não foi possível marcar a reunião"),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelMeeting({ data: { id } }),
    onSuccess: async () => {
      await refresh();
      toast("Reunião cancelada");
    },
    onError: errorToast("Não foi possível cancelar a reunião"),
  });
  const propose = useMutation({
    mutationFn: ({ draft, sendEmail }: { draft: ProposalDraft; sendEmail: boolean }) =>
      saveProposal({ data: { leadId, ...draft, sendEmail } }),
    onSuccess: async (result) => {
      await refresh();
      savedToast(result.queued ? "Proposta na fila de envio" : "Proposta salva", result);
    },
    onError: errorToast("Não foi possível salvar a proposta"),
  });

  return {
    meetings: sales.data?.meetings ?? [],
    proposal: sales.data?.proposal ?? null,
    emailsEnabled: sales.data?.emailsEnabled ?? false,
    table: table.data ?? null,
    tableError: table.isError,
    copyText,
    schedule: (draft: MeetingDraft, options?: { onSuccess?: () => void }) =>
      schedule.mutate(draft, options),
    cancel: (id: string) => cancel.mutate(id),
    propose: (draft: ProposalDraft, sendEmail: boolean, options?: { onSuccess?: () => void }) =>
      propose.mutate({ draft, sendEmail }, options),
    scheduling: schedule.isPending,
    cancelling: cancel.isPending,
    proposing: propose.isPending,
  };
}

export type LeadSales = ReturnType<typeof useLeadSales>;
