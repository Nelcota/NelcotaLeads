import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { teamQuery } from "@/lib/queries";
import { firstIssue } from "@/lib/form-result";
import { inviteInputSchema, signUpUrl, type InviteDelivery } from "@/lib/team";
import { deleteInvite, inviteTeammate } from "@/server/team";

const DELIVERY_TOASTS: Record<InviteDelivery, string> = {
  off: "Convite salvo. Mande o link de criar conta para a pessoa.",
  sent: "Convite enviado por e-mail.",
  failed: "Convite salvo, mas o e-mail não saiu. Mande o link de criar conta para a pessoa.",
  "no-mailbox": "Convite salvo. A caixa de e-mail não está conectada: mande o link para a pessoa.",
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

/** "Equipe": the accounts and invites, the invite form, "Remover" and "Copiar link". */
export function useTeam() {
  const queryClient = useQueryClient();
  const { data, isError } = useQuery(teamQuery);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    if (!parsed.success) {
      setError(firstIssue(parsed.error.issues));
      return;
    }
    invite.mutate(parsed.data.email);
  };

  return {
    data,
    failed: isError,
    copyLink: () => void copySignUpLink(),
    email,
    error,
    changeEmail,
    submitInvite,
    inviting: invite.isPending,
    removeInvite: (id: string) => remove.mutate(id),
    removingId: (remove.isPending ? remove.variables : null) ?? null,
  };
}
