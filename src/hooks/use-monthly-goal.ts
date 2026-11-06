import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  goalFormValues,
  goalPace,
  parseGoalForm,
  type GoalFormValues,
  type MonthlyGoalInput,
} from "@/lib/goal";
import { errorToast } from "@/lib/mutation-toasts";
import { monthlyGoalQuery } from "@/lib/queries";
import { saveMonthlyGoal } from "@/server/goals";

/**
 * "Meta do mês": the goal in force, the month's progress and pace, and the "Editar meta" form
 * (checked here, saved for the current month on).
 */
export function useMonthlyGoal() {
  const queryClient = useQueryClient();
  const { data, isError } = useQuery(monthlyGoalQuery);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<GoalFormValues>(() => goalFormValues(null));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (goal: MonthlyGoalInput) => saveMonthlyGoal({ data: goal }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["monthly-goal"] });
      setEditing(false);
      toast.success("Meta do mês salva");
    },
    onError: errorToast("Não foi possível salvar a meta"),
  });

  const goal = data?.goal ?? null;
  const pace = data && goal ? goalPace(goal, data.progress, data.today) : null;

  const startEditing = () => {
    setValues(goalFormValues(goal));
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setError(null);
    setEditing(false);
  };
  const change = (patch: Partial<GoalFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const submit = () => {
    const parsed = parseGoalForm(values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    save.mutate(parsed.value);
  };

  return {
    data,
    failed: isError,
    goal,
    pace,
    editing,
    values,
    error,
    saving: save.isPending,
    startEditing,
    cancel,
    change,
    submit,
  };
}
