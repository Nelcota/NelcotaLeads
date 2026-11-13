import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorToast } from "@/lib/mutation-toasts";
import { systemStatusQuery } from "@/lib/queries";
import type { Job } from "@/lib/system-status";
import { runAutopilotNow } from "@/server/dashboard";
import { checkMailNow } from "@/server/mail";

/** The task's own manual run, reused as "Tentar agora"; tasks without one get no button. */
const RETRY: Partial<Record<Job, () => Promise<unknown>>> = {
  send: () => checkMailNow(),
  inbox: () => checkMailNow(),
  autopilot: () => runAutopilotNow(),
};

/** "Tentar agora" for one background task; null when the task has no manual run. */
export function useJobRetry(job: Job) {
  const queryClient = useQueryClient();
  const run = RETRY[job];
  const mutation = useMutation({
    mutationFn: async () => run?.(),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: systemStatusQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]),
    // The row itself shows the new state, so success needs no toast.
    onError: errorToast("Não foi possível tentar agora"),
  });
  if (!run) return null;
  return { retrying: mutation.isPending, retry: () => mutation.mutate() };
}
