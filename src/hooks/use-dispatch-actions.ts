import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { DispatchDraft, useDispatchDrafts } from "@/hooks/use-dispatch-drafts";
import { useAutosave } from "@/lib/autosave";
import { isSavableDraft, reviewBusy } from "@/lib/dispatch-review";
import { errorToast } from "@/lib/mutation-toasts";
import { SEND_GAP_MINUTES } from "@/lib/schemas";
import { dispatchEmails, removeDraft, rewriteDraft, updateDraft } from "@/server/mail";

export type DraftText = { subject: string; body: string };

type DispatchReviewDrafts = ReturnType<typeof useDispatchDrafts>;

/**
 * What the user does to the drafts of one dispatch review: edit (autosaved), rewrite with the
 * AI, take one out, and put them all in the send queue.
 */
export function useDispatchActions({
  review,
  onDispatched,
}: {
  review: DispatchReviewDrafts;
  onDispatched: () => void;
}) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, DraftText>>({});

  // Edits are stored as they are typed, so closing the sheet keeps them.
  const autosave = useAutosave(
    (id, edit: DraftText) => updateDraft({ data: { id, ...edit } }),
    errorToast("Não foi possível salvar a edição", { id: "dispatch-draft" }),
  );
  const textOf = (draft: DispatchDraft): DraftText =>
    edits[draft.id] ?? { subject: draft.subject, body: draft.body };
  const edit = (id: string, next: DraftText) => {
    setEdits((all) => ({ ...all, [id]: next }));
    if (isSavableDraft(next)) {
      autosave.schedule(id, next);
      return;
    }
    void autosave.discard(id);
  };
  const showVersion = (id: string, text: Partial<DispatchDraft>) => {
    review.replace(id, text);
    setEdits(({ [id]: _dropped, ...rest }) => rest);
  };
  // Runs from the toast, which may outlive the sheet.
  const restore = async (id: string, previous: DraftText) => {
    try {
      await updateDraft({ data: { id, ...previous } });
      showVersion(id, previous);
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };

  const rewrite = useMutation({
    mutationFn: async ({ id }: { id: string; previous: DraftText }) => {
      await autosave.flush();
      return rewriteDraft({ data: { id } });
    },
    onSuccess: (draft, { id, previous }) => {
      if (!draft) return;
      showVersion(id, draft);
      toast("Nova versão gerada", {
        duration: 6000,
        action: { label: "Desfazer", onClick: () => void restore(id, previous) },
      });
    },
    onError: errorToast("Não foi possível reescrever"),
  });
  const remove = useMutation({
    mutationFn: async (draft: DispatchDraft) => {
      await autosave.discard(draft.id);
      return removeDraft({ data: { id: draft.id } });
    },
    onSuccess: (_result, draft) => review.drop(draft),
    onError: errorToast("Não foi possível tirar do disparo"),
  });
  const dispatch = useMutation({
    mutationFn: async () => {
      await autosave.flush();
      // Also surfaces an edit that could not be saved (e.g. an empty subject) before sending.
      for (const [id, text] of Object.entries(edits)) {
        await updateDraft({ data: { id, ...text } });
      }
      return dispatchEmails({ data: { ids: review.drafts.map((draft) => draft.id) } });
    },
    onSuccess: async ({ queued }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
        queryClient.invalidateQueries({ queryKey: ["cold-room"] }),
      ]);
      toast.success(`${queued} ${queued === 1 ? "e-mail na fila" : "e-mails na fila"}`, {
        description: `Um a cada ${SEND_GAP_MINUTES} minutos. As respostas aparecem em Conversas.`,
      });
      onDispatched();
    },
    onError: errorToast("Não foi possível disparar"),
  });

  return {
    textOf,
    edit,
    saveState: autosave.state,
    rewrite: (id: string, previous: DraftText) => rewrite.mutate({ id, previous }),
    rewriting: rewrite.isPending,
    remove: (draft: DispatchDraft) => remove.mutate(draft),
    removing: remove.isPending,
    dispatch: () => dispatch.mutate(),
    dispatching: dispatch.isPending,
    busy: reviewBusy({
      removing: remove.isPending,
      rewriting: rewrite.isPending,
      writing: review.writing,
    }),
  };
}
