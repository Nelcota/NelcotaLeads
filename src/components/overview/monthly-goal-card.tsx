import { TargetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMonthlyGoal } from "@/hooks/use-monthly-goal";
import { monthName, paceLine, type GoalPace } from "@/lib/goal";
import { formatCents } from "@/lib/money";
import type { MonthlyGoalStatus } from "@/server/goals";
import { GoalForm } from "./goal-form";
import { ProgressBar } from "./progress-bar";

function GoalRow({
  title,
  done,
  target,
  percent,
}: {
  title: string;
  done: string;
  target: string;
  percent: number;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="text-muted-foreground">{title}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{done}</span>
          <span className="text-muted-foreground"> de {target}</span>
          <span className="ml-1.5 text-[12px] text-tertiary">{percent}%</span>
        </span>
      </div>
      <ProgressBar
        share={percent / 100}
        tone={percent >= 100 ? "green" : "primary"}
        label={`${title}: ${percent}%`}
      />
    </div>
  );
}

function GoalProgress({ status, pace }: { status: MonthlyGoalStatus; pace: GoalPace }) {
  const { goal, progress, month } = status;
  if (!goal) return null;
  const inherited = goal.month !== month;
  return (
    <div className="grid gap-4 border-t border-border/60 px-5 py-4">
      <GoalRow
        title="Fechamentos"
        done={String(progress.deals)}
        target={String(goal.deals)}
        percent={pace.dealsPercent}
      />
      <GoalRow
        title="Receita"
        done={formatCents(progress.revenueCents)}
        target={formatCents(goal.revenueCents)}
        percent={pace.revenuePercent}
      />
      <p className="text-[13.5px] text-muted-foreground">{paceLine(pace)}</p>
      {inherited ? (
        <p className="text-[12.5px] text-tertiary">Mesma meta de {monthName(goal.month)}.</p>
      ) : null}
    </div>
  );
}

function NoGoal({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 border-t border-border/60 px-5 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <TargetIcon className="size-4" aria-hidden />
        Defina a meta do mês
      </div>
      <Button size="sm" onClick={onEdit}>
        Editar meta
      </Button>
    </div>
  );
}

/** "Meta do mês": deals and revenue against the goal, the pace, and "Editar meta". */
export function MonthlyGoalCard() {
  const goal = useMonthlyGoal();
  const { data } = goal;
  if (!data) return null;
  return (
    <section aria-labelledby="monthly-goal" className="grouped enter">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-5 pt-4 pb-2">
        <h2 id="monthly-goal" className="text-[17px] font-semibold">
          Meta do mês
        </h2>
        <span className="text-sm text-muted-foreground">{monthName(data.month)}</span>
        <span className="min-w-0 flex-1" />
        {goal.goal && !goal.editing ? (
          <Button size="sm" variant="ghost" onClick={goal.startEditing}>
            Editar meta
          </Button>
        ) : null}
      </div>
      {goal.editing ? (
        <GoalForm
          values={goal.values}
          error={goal.error}
          saving={goal.saving}
          onChange={goal.change}
          onSubmit={goal.submit}
          onCancel={goal.cancel}
        />
      ) : goal.pace ? (
        <GoalProgress status={data} pace={goal.pace} />
      ) : (
        <NoGoal onEdit={goal.startEditing} />
      )}
    </section>
  );
}
