import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { appendDrafts, leadsWithoutDraft } from "@/lib/dispatch-review";
import { errorToast } from "@/lib/mutation-toasts";
import { reusableDraftsQuery } from "@/lib/queries";
import { prepareEmails } from "@/server/mail";

export type DispatchDraft = Awaited<ReturnType<typeof prepareEmails>>["drafts"][number];
export type DispatchSkip = Awaited<ReturnType<typeof prepareEmails>>["skipped"][number];

/**
 * The drafts of one dispatch review. Opening it only reads the drafts already written; the AI
 * writes the missing ones when `write` is called, and only for the leads without a draft.
 */
export function useDispatchDrafts(leadIds: string[]) {
  const existing = useQuery(reusableDraftsQuery(leadIds));
  // Null until the saved drafts arrive; from then on the review edits its own copy.
  const [drafts, setDrafts] = useState<DispatchDraft[] | null>(null);
  const [skipped, setSkipped] = useState<DispatchSkip[]>([]);

  const loaded = existing.data;
  if (drafts === null && loaded !== undefined) setDrafts(loaded);

  const list = drafts ?? [];
  const missing = leadsWithoutDraft(leadIds, list, skipped);

  const prepare = useMutation({
    mutationFn: (ids: string[]) => prepareEmails({ data: { leadIds: ids } }),
    onSuccess: (result) => {
      setDrafts((current) => appendDrafts(current ?? [], result.drafts));
      setSkipped((current) => [...current, ...result.skipped]);
    },
    onError: errorToast("A IA não conseguiu escrever os e-mails"),
  });

  const write = () => {
    if (missing.length === 0 || prepare.isPending) return;
    prepare.mutate(missing);
  };
  const replace = (id: string, patch: Partial<DispatchDraft>) =>
    setDrafts((current) =>
      (current ?? []).map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  const drop = (id: string) =>
    setDrafts((current) => (current ?? []).filter((draft) => draft.id !== id));

  return {
    drafts: list,
    skipped,
    missing,
    // A failed read leaves nothing to show, but the AI can still write every e-mail.
    loading: drafts === null && existing.isPending && leadIds.length > 0,
    loadFailed: existing.isError,
    writing: prepare.isPending,
    write,
    replace,
    drop,
  };
}
