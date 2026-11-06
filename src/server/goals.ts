import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { localDay } from "@/lib/format";
import { monthlyGoalInputSchema, monthOf } from "@/lib/goal";
import { monthlyGoalStatus, storeGoal } from "./goal-store";

/** "Meta do mês": the goal in force this month (Brazil time) and what was won so far. */
export const getMonthlyGoal = createServerFn({ method: "GET" }).handler(async () => {
  const today = localDay(new Date());
  return { today, ...(await monthlyGoalStatus(getDb(), monthOf(today))) };
});

export type MonthlyGoalStatus = Awaited<ReturnType<typeof getMonthlyGoal>>;

/** "Editar meta" → Salvar: the goal of the current month on; past months keep theirs. */
export const saveMonthlyGoal = createServerFn({ method: "POST" })
  .validator(monthlyGoalInputSchema)
  .handler(async ({ data }) => {
    const now = new Date();
    await storeGoal(getDb(), monthOf(localDay(now)), data, now);
    return { ok: true as const };
  });
