import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { cancelTodaysDispatch, pauseDispatch, resumeDispatch } from "@/server/dispatch";

/**
 * "Pausar", "Retomar" and "Cancelar disparo" on the overview. Cancelling asks first:
 * `askCancel` opens the inline confirmation, `confirmCancel` runs it, `keepRunning` closes it.
 */
export function useDispatchControl() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
    ]);
  const pause = useMutation({
    mutationFn: () => pauseDispatch(),
    onSuccess: async () => {
      await refresh();
      toast("Disparo pausado", { description: "As respostas em conversa continuam saindo." });
    },
    onError: errorToast("Não foi possível pausar o disparo"),
  });
  const resume = useMutation({
    mutationFn: () => resumeDispatch(),
    onSuccess: async () => {
      await refresh();
      toast.success("Disparo retomado");
    },
    onError: errorToast("Não foi possível retomar o disparo"),
  });
  const cancel = useMutation({
    mutationFn: () => cancelTodaysDispatch(),
    onSuccess: async ({ cancelled }) => {
      setConfirming(false);
      await refresh();
      toast.success(
        cancelled === 1 ? "1 e-mail cancelado" : `${cancelled} e-mails cancelados`,
        { description: "Os leads voltaram para A contatar." },
      );
    },
    onError: errorToast("Não foi possível cancelar o disparo"),
  });
  return {
    pause: () => pause.mutate(),
    resume: () => resume.mutate(),
    askCancel: () => setConfirming(true),
    keepRunning: () => setConfirming(false),
    confirmCancel: () => cancel.mutate(),
    confirming,
    switching: pause.isPending || resume.isPending,
    cancelling: cancel.isPending,
  };
}
