import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { sendWindowQuery } from "@/lib/queries";
import { sendWindowInputSchema, type SendWindowInput } from "@/lib/schemas";
import { saveSendWindow } from "@/server/dispatch";

export type SendWindowEdge = keyof SendWindowInput;

/**
 * The send window in Configurações: each hour picked is saved at once, like the switches.
 * A pick that leaves the end before the start is not saved and returns the reason instead.
 */
export function useSendWindow() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(sendWindowQuery);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (next: SendWindowInput) => saveSendWindow({ data: next }),
    onSuccess: async (_result, next) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["send-window"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(`Envios das ${next.start}h às ${next.end}h`);
    },
    onError: errorToast("Não foi possível salvar o horário de envio"),
  });
  // While saving, the picked hours show instead of the stored ones.
  const window = save.isPending && save.variables ? save.variables : data;

  const change = (edge: SendWindowEdge, hour: number) => {
    const parsed = sendWindowInputSchema.safeParse({ ...window, [edge]: hour });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Horário inválido");
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  };

  return { window, change, error, saving: save.isPending };
}
