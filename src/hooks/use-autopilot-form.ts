import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useReportDirtyForm } from "@/components/leave-guard";
import { errorToast } from "@/lib/mutation-toasts";
import { autopilotQuery } from "@/lib/queries";
import { autopilotInputSchema, type AutopilotInput } from "@/lib/schemas";
import { saveAutopilot, setAutomation } from "@/server/dashboard";

// Same bound as the autopilot schema (src/lib/schemas.ts).
export const MAX_TARGETS = 10;

/** The three automation switches; each applies at once, without "Salvar". */
export type AutomationSwitch = "aiAutoReply" | "autoDispatch" | "enabled";

const AUTOMATION_KEY = {
  aiAutoReply: "aiAutoReply",
  autoDispatch: "autoDispatch",
  enabled: "autopilot",
} as const;

/**
 * Configurações → Automação: the switches (saved at once) and the daily search form (niches,
 * hour and size, saved with "Salvar busca diária"). A switch's saved value becomes the form's
 * default, so flipping one never counts as an unsaved change.
 */
export function useAutopilotForm() {
  const { data: defaults } = useSuspenseQuery(autopilotQuery);
  const queryClient = useQueryClient();
  const form = useForm<AutopilotInput>({
    resolver: zodResolver(autopilotInputSchema),
    defaultValues: defaults,
  });
  const targets = useFieldArray({ control: form.control, name: "targets" });
  const { isDirty } = form.formState;
  useReportDirtyForm("autopilot", isDirty);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["autopilot"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const save = useMutation({
    mutationFn: (data: AutopilotInput) => saveAutopilot({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await refresh();
      toast.success("Busca diária salva");
    },
    onError: errorToast("Não foi possível salvar a busca diária"),
  });

  const toggle = useMutation({
    mutationFn: ({ name, checked }: { name: AutomationSwitch; checked: boolean }) =>
      setAutomation({ data: { [AUTOMATION_KEY[name]]: checked } }),
    onSuccess: async (_result, { name, checked }) => {
      form.resetField(name, { defaultValue: checked });
      await refresh();
    },
    onError: (error, { name }) => {
      // Back to the saved default, and not dirty: nothing changed on the server.
      form.resetField(name);
      errorToast("Não foi possível mudar a automação")(error);
    },
  });

  // Removed at once; "Desfazer" puts it back in the same place.
  const removeTarget = (index: number) => {
    const removed = form.getValues(`targets.${index}`);
    targets.remove(index);
    toast("Nicho removido", {
      description:
        removed.niche || removed.city ? `${removed.niche} em ${removed.city}` : undefined,
      action: {
        label: "Desfazer",
        onClick: () => {
          if (form.getValues("targets").length >= MAX_TARGETS) {
            toast.error(`Máximo de ${MAX_TARGETS} nichos`);
            return;
          }
          targets.insert(index, removed, { shouldFocus: false });
        },
      },
    });
  };

  const addTarget = () => targets.append({ niche: "", city: "" });

  const submit = form.handleSubmit((data) => save.mutate(data));

  const discard = () => {
    setConfirmDiscard(false);
    form.reset(defaults);
  };

  const switchPending = (name: AutomationSwitch) =>
    toggle.isPending && toggle.variables.name === name;

  return {
    form,
    targets: targets.fields,
    full: targets.fields.length >= MAX_TARGETS,
    addTarget,
    removeTarget,
    submit,
    saving: save.isPending,
    isDirty,
    flip: (name: AutomationSwitch, checked: boolean) => toggle.mutate({ name, checked }),
    switchPending,
    confirmDiscard,
    askDiscard: () => setConfirmDiscard(true),
    cancelDiscard: () => setConfirmDiscard(false),
    discard,
  };
}

export type AutopilotFormState = ReturnType<typeof useAutopilotForm>;
