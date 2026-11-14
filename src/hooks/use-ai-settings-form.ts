import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { useReportDirtyForm } from "@/components/leave-guard";
import { errorToast } from "@/lib/mutation-toasts";
import { settingsQuery } from "@/lib/queries";
import { settingsInputSchema, type SettingsInput } from "@/lib/schemas";
import { saveSettings } from "@/server/settings";

export type NumberFieldName = "minScore" | `criteria.${number}.weight`;

/** Highest score the positive weights allow (the score is capped at 100). */
function positiveWeightSum(criteria: SettingsInput["criteria"] | undefined): number {
  return (criteria ?? []).reduce(
    (sum, criterion) =>
      sum + (Number.isFinite(criterion.weight) && criterion.weight > 0 ? criterion.weight : 0),
    0,
  );
}

/**
 * Configurações → IA e pontuação: offer, ideal customer, criteria, minimum score and tone in one
 * form, saved together. The sender fields ride along unchanged (they are edited in Conta).
 */
export function useAiSettingsForm() {
  const { data: defaults } = useSuspenseQuery(settingsQuery);
  const queryClient = useQueryClient();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsInputSchema),
    defaultValues: defaults,
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const watchedCriteria = useWatch({ control: form.control, name: "criteria" });
  const tone = useWatch({ control: form.control, name: "tone" });
  const minScore = useWatch({ control: form.control, name: "minScore" });
  const { isDirty, isSubmitted } = form.formState;
  useReportDirtyForm("settings", isDirty);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const save = useMutation({
    mutationFn: (data: SettingsInput) => saveSettings({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
      ]);
      toast.success("Configurações salvas");
    },
    onError: errorToast("Não foi possível salvar as configurações"),
  });

  // Removed at once; "Desfazer" puts it back in the same place.
  const removeCriterion = (index: number) => {
    const removed = form.getValues(`criteria.${index}`);
    criteria.remove(index);
    toast("Critério removido", {
      description: removed.label || undefined,
      action: {
        label: "Desfazer",
        onClick: () => criteria.insert(index, removed, { shouldFocus: false }),
      },
    });
  };

  const setNumber = (name: NumberFieldName, value: number) =>
    form.setValue(name, value, { shouldDirty: true, shouldValidate: isSubmitted });

  const setTone = (value: SettingsInput["tone"]) =>
    form.setValue("tone", value, { shouldDirty: true });

  return {
    form,
    defaults,
    criteria: criteria.fields,
    watchedCriteria,
    addCriterion: () => criteria.append({ label: "", weight: 10 }),
    removeCriterion,
    maxScore: positiveWeightSum(watchedCriteria),
    tone,
    setTone,
    minScore,
    setNumber,
    submit: form.handleSubmit((data) => save.mutate(data)),
    saving: save.isPending,
    isDirty,
    confirmDiscard,
    askDiscard: () => setConfirmDiscard(true),
    cancelDiscard: () => setConfirmDiscard(false),
    discard: () => {
      setConfirmDiscard(false);
      form.reset(defaults);
    },
  };
}

export type AiSettingsFormState = ReturnType<typeof useAiSettingsForm>;
