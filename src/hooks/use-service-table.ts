import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { serviceTableQuery } from "@/lib/queries";
import type { AddonInput, ServiceInput } from "@/lib/services";
import {
  archiveAddon,
  archiveService,
  createAddon,
  createService,
  updateAddon,
  updateService,
} from "@/server/services";

type Done = { onSuccess?: () => void };

/** "Serviços e preços": the table and its add, edit and archive actions. */
export function useServiceTable() {
  const queryClient = useQueryClient();
  const table = useQuery(serviceTableQuery);
  const refresh = () => queryClient.invalidateQueries({ queryKey: serviceTableQuery.queryKey });

  const saveService = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ServiceInput }) =>
      id ? updateService({ data: { id, ...input } }) : createService({ data: input }),
    onSuccess: async (_result, { id }) => {
      await refresh();
      toast.success(id ? "Serviço atualizado" : "Serviço adicionado");
    },
    onError: errorToast("Não foi possível salvar o serviço"),
  });
  const removeService = useMutation({
    mutationFn: (id: string) => archiveService({ data: { id } }),
    onSuccess: async () => {
      await refresh();
      toast("Serviço arquivado", { description: "Propostas já feitas continuam com ele." });
    },
    onError: errorToast("Não foi possível arquivar o serviço"),
  });
  const saveAddon = useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: AddonInput }) =>
      id ? updateAddon({ data: { id, ...input } }) : createAddon({ data: input }),
    onSuccess: async (_result, { id }) => {
      await refresh();
      toast.success(id ? "Adicional atualizado" : "Adicional adicionado");
    },
    onError: errorToast("Não foi possível salvar o adicional"),
  });
  const removeAddon = useMutation({
    mutationFn: (id: string) => archiveAddon({ data: { id } }),
    onSuccess: async () => {
      await refresh();
      toast("Adicional arquivado");
    },
    onError: errorToast("Não foi possível arquivar o adicional"),
  });

  return {
    table: table.data ?? null,
    loadError: table.isError,
    saveService: (id: string | null, input: ServiceInput, done?: Done) =>
      saveService.mutate({ id, input }, done),
    archiveService: (id: string) => removeService.mutate(id),
    saveAddon: (id: string | null, input: AddonInput, done?: Done) =>
      saveAddon.mutate({ id, input }, done),
    archiveAddon: (id: string) => removeAddon.mutate(id),
    savingService: saveService.isPending,
    savingAddon: saveAddon.isPending,
    archiving: removeService.isPending || removeAddon.isPending,
  };
}

export type ServiceTableActions = ReturnType<typeof useServiceTable>;
