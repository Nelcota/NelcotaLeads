import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { firstIssue } from "@/lib/form-result";
import { inviteInputSchema, signUpUrl, type InviteDelivery } from "@/lib/team";
import { deleteInvite, inviteTeammate, resendInvite } from "@/server/team";

const DELIVERY_TOASTS: Record<InviteDelivery, string> = {
  off: "Convite salvo. Mande o link de criar conta para a pessoa.",
  sent: "Convite enviado por e-mail.",
  failed: "Convite salvo, mas o e-mail não saiu. Mande o link de criar conta para a pessoa.",
  "no-mailbox": "Convite salvo. A caixa de e-mail não está conectada: mande o link para a pessoa.",
};

const RESEND_TOASTS: Record<InviteDelivery, string> = {
  off: "Envio desligado: mande o link de criar conta para a pessoa.",
  sent: "Convite reenviado por e-mail.",
  failed: "O e-mail não saiu. Mande o link de criar conta para a pessoa.",
  "no-mailbox": "A caixa de e-mail não está conectada: mande o link para a pessoa.",
};

/** The sign-up link of this app, as the browser reaches it (empty while rendering on the server). */
function currentSignUpUrl(): string {
  if (typeof window === "undefined") return "";
  return signUpUrl(window.location.origin);
}

/** Copies the sign-up link; says so, or that the browser refused. */
async function copySignUpLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(currentSignUpUrl());
    toast.success("Link de criar conta copiado");
  } catch (error) {
    console.warn("team: could not copy the sign-up link", error);
    toast.error("Não foi possível copiar. Copie o link manualmente.");
  }
}

/** "Convites": the form, "Copiar link", "Reenviar" and "Remover". */
export function useInvites() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Bumped on each refused submit, so the field shakes again.
  const [errorCount, setErrorCount] = useState(0);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team"] });

  const invite = useMutation({
    mutationFn: (address: string) => inviteTeammate({ data: { email: address } }),
    onSuccess: async (result) => {
      await refresh();
      setEmail("");
      toast.success(DELIVERY_TOASTS[result.delivery]);
    },
    onError: errorToast("Não foi possível convidar"),
  });
  const resend = useMutation({
    mutationFn: (id: string) => resendInvite({ data: { id } }),
    onSuccess: (result) => toast(RESEND_TOASTS[result.delivery]),
    onError: errorToast("Não foi possível reenviar o convite"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteInvite({ data: { id } }),
    onSuccess: async () => {
      await refresh();
      toast("Convite removido");
    },
    onError: errorToast("Não foi possível remover o convite"),
  });

  const changeEmail = (value: string) => {
    setEmail(value);
    setError(null);
  };
  const submitInvite = () => {
    const parsed = inviteInputSchema.safeParse({ email });
    if (parsed.success) {
      invite.mutate(parsed.data.email);
      return;
    }
    setError(firstIssue(parsed.error.issues));
    setErrorCount((count) => count + 1);
  };

  return {
    copyLink: () => void copySignUpLink(),
    email,
    error,
    errorCount,
    changeEmail,
    submitInvite,
    inviting: invite.isPending,
    resendInvite: (id: string) => resend.mutate(id),
    resendingId: (resend.isPending ? resend.variables : null) ?? null,
    removeInvite: (id: string) => remove.mutate(id),
    removingId: (remove.isPending ? remove.variables : null) ?? null,
  };
}
