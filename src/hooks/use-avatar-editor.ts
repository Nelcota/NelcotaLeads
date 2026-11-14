import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { accountQuery } from "@/lib/queries";
import { saveAvatar } from "@/server/account";

/**
 * The profile photo editor, opened from several places on Conta (the photo, "Alterar foto",
 * "Alterar"). Each opening starts a fresh editor (`session` is its key).
 */
export function useAvatarEditor() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const mutation = useMutation({
    mutationFn: async (avatar: string | null) => saveAvatar({ data: { avatar } }),
    onSuccess: async (_result, avatar) => {
      await queryClient.invalidateQueries({ queryKey: accountQuery.queryKey });
      setOpen(false);
      toast.success(avatar ? "Foto atualizada" : "Foto removida");
    },
    onError: errorToast("Não foi possível salvar a foto"),
  });

  const openEditor = () => {
    setSession((count) => count + 1);
    setOpen(true);
  };

  return {
    openEditor,
    session,
    open,
    setOpen,
    saving: mutation.isPending,
    save: (avatar: string | null) => mutation.mutate(avatar),
  };
}
