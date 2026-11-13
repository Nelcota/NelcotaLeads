import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { cancelSearch, hideSearch, repeatSearch } from "@/server/searches";

/** "Buscar de novo" and "Tentar de novo": a new search with the same niche, city and size. */
export function useRepeatSearch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => repeatSearch({ data: { id } }),
    onSuccess: async ({ searchId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
      ]);
      toast.success("Busca feita de novo", {
        description: "Os leads aparecem conforme a análise termina.",
        action: {
          label: "Ver leads",
          onClick: () => void navigate({ to: "/leads", search: { view: "all", searchId } }),
        },
      });
    },
    onError: errorToast("Não foi possível repetir a busca"),
  });
}

/** Stops a running search; what was already collected and analyzed stays in Leads. */
export function useCancelSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelSearch({ data: { id } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast("Busca cancelada", {
        description: "O que já foi coletado e analisado continua nos leads.",
      });
    },
    onError: errorToast("Não foi possível cancelar a busca"),
  });
}

function leadsKeptText(leads: number): string {
  if (leads === 0) return "";
  if (leads === 1) return " O lead continua em Leads.";
  return ` Os ${leads} leads continuam em Leads.`;
}

/** Hides the search from the list right away; its leads stay. Undo brings it back. */
export function useHideSearch() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["searches"] });
  const undo = async (id: string) => {
    try {
      await hideSearch({ data: { id, hidden: false } });
      await refresh();
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };
  return useMutation({
    mutationFn: (id: string) => hideSearch({ data: { id, hidden: true } }),
    onSuccess: async (result, id) => {
      await refresh();
      toast("Busca ocultada", {
        description: `Para ver de novo, use o filtro Ocultas.${leadsKeptText(result.leads)}`,
        action: { label: "Desfazer", onClick: () => void undo(id) },
      });
    },
    onError: errorToast("Não foi possível ocultar a busca"),
  });
}

/** "Mostrar na lista" on a hidden search: back among the others. */
export function useUnhideSearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hideSearch({ data: { id, hidden: false } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["searches"] });
      toast.success("Busca de volta na lista");
    },
    onError: errorToast("Não foi possível mostrar a busca"),
  });
}
