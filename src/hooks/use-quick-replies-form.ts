import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useReportDirtyForm } from "@/components/leave-guard";
import { errorToast } from "@/lib/mutation-toasts";
import { quickRepliesQuery } from "@/lib/queries";
import {
  QUICK_REPLY_LIMITS,
  quickRepliesInputSchema,
  type QuickRepliesInput,
} from "@/lib/schemas";
import { saveQuickReplies } from "@/server/settings";

/** "Respostas rápidas": the team's reply templates, edited as one list and saved together. */
export function useQuickRepliesForm(defaults: QuickRepliesInput) {
  const queryClient = useQueryClient();
  const form = useForm<QuickRepliesInput>({
    resolver: zodResolver(quickRepliesInputSchema),
    defaultValues: defaults,
  });
  const replies = useFieldArray({ control: form.control, name: "replies" });
  const { isDirty } = form.formState;
  useReportDirtyForm("quick-replies", isDirty);

  const save = useMutation({
    mutationFn: (data: QuickRepliesInput) => saveQuickReplies({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: quickRepliesQuery.queryKey });
      toast.success("Respostas rápidas salvas");
    },
    onError: errorToast("Não foi possível salvar as respostas rápidas"),
  });

  return {
    form,
    replies: replies.fields,
    full: replies.fields.length >= QUICK_REPLY_LIMITS.count,
    add: () => replies.append({ title: "", body: "" }),
    remove: (index: number) => replies.remove(index),
    submit: form.handleSubmit((data) => save.mutate(data)),
    saving: save.isPending,
    isDirty,
  };
}
