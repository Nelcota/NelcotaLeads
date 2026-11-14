import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { testMailConnection } from "@/server/mail";

/** "Testar conexão": checks sending and reading on the mailbox, the result in a toast. */
export function useMailTest() {
  const test = useMutation({
    mutationFn: () => testMailConnection(),
    onSuccess: (result) =>
      result.ok ? toast.success(result.message) : toast.error(result.message),
    onError: errorToast("Não foi possível testar a conexão. Confira a sua internet."),
  });
  return { run: () => test.mutate(), testing: test.isPending };
}
