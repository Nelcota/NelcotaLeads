import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { settingsQuery } from "@/lib/queries";
import type { SettingsInput } from "@/lib/schemas";
import { saveSettings } from "@/server/settings";

export type SenderField = keyof Pick<SettingsInput, "senderName" | "senderCompany">;

/**
 * The sender of the team's e-mails (name and company). They live in the shared settings record,
 * so a save sends the rest of it back unchanged. Saves run one after another and each reads the
 * latest record, so saving the name and then the company never puts the old name back.
 */
export function useSenderProfile() {
  const queryClient = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const mutation = useMutation({
    scope: { id: "sender-profile" },
    mutationFn: async (change: Partial<Record<SenderField, string>>) => {
      const latest = queryClient.getQueryData(settingsQuery.queryKey) ?? settings;
      const next = { ...latest, ...change };
      await saveSettings({ data: next });
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(settingsQuery.queryKey, next);
      toast.success("Remetente salvo");
    },
    onError: errorToast("Não foi possível salvar o remetente"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey }),
  });

  const save = async (field: SenderField, value: string) => mutation.mutateAsync({ [field]: value });

  return { senderName: settings.senderName, senderCompany: settings.senderCompany, save };
}
