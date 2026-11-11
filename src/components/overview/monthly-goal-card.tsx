import { TargetIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMonthlyGoal } from "@/hooks/use-monthly-goal";
import { formatCount } from "@/lib/format";
import { monthName, paceLine, type GoalPace } from "@/lib/goal";
import { formatCents } from "@/lib/money";
import { ratePercent } from "@/lib/overview-metrics";
import type { MonthlyGoalStatus } from "@/server/goals";
import { GoalForm } from "./goal-form";
import { ProgressBar } from "./progress-bar";

function GoalRow({
  title,
  done,
  target,
  percent,
  barPercent,
}: {
  title: string;
  done: string;
  target: string;
  /** The real share, so a month past its goal reads "150%". */
  percent: number;
  /** The same share capped at 100 for the bar. */
  barPercent: number;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-base">
        <span className="text-muted-foreground">{title}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{done}</span>
          <span className="text-muted-foreground"> de {target}</span>
          <span className="ml-1.5 text-xs text-tertiary">{percent}%</span>
        </span>
      </div>
      <ProgressBar
        share={barPercent / 100}
        tone={barPercent >= 100 ? "green" : "primary"}
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
    <div className="flex flex-1 flex-col gap-4 border-t border-border/60 px-5 py-4">
      <GoalRow
        title="Fechamentos"
        done={formatCount(progress.deals)}
        target={formatCount(goal.deals)}
        percent={ratePercent(progress.deals, goal.deals) ?? 0}
        barPercent={pace.dealsPercent}
      />
      <GoalRow
        title="Receita"
        done={formatCents(progress.revenueCents)}
        target={formatCents(goal.revenueCents)}
        percent={ratePercent(progress.revenueCents, goal.revenueCents) ?? 0}
        barPercent={pace.revenuePercent}
      />
      {/* At the bottom, so the card lines up with today's agenda beside it. */}
      <p className="mt-auto text-base text-muted-foreground">{paceLine(pace)}</p>
      {inherited ? (
        <p className="text-sm text-tertiary">Mesma meta de {monthName(goal.month)}.</p>
      ) : null}
    </div>
  );
}

function NoGoal({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-start gap-3 border-t border-border/60 px-5 py-4">
      <div className="flex items-start gap-2.5">
        <TargetIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-base text-muted-foreground">
          Defina quantos fechamentos e quanto de receita a equipe quer neste mês. O progresso
          aparece aqui a cada lead fechado.
        </p>
      </div>
      <Button size="sm" onClick={onEdit}>
        Definir meta
      </Button>
    </div>
  );
}

function GoalUnavailable() {
  return (
    <p className="flex-1 border-t border-border/60 px-5 py-4 text-base text-muted-foreground">
      Não foi possível carregar a meta agora. Recarregue a página para tentar de novo.
    </p>
  );
}

function GoalBody({ goal }: { goal: ReturnType<typeof useMonthlyGoal> }) {
  const { data } = goal;
  if (!data) return <GoalUnavailable />;
  if (goal.editing) {
    return (
      <GoalForm
        values={goal.values}
        error={goal.error}
        saving={goal.saving}
        onChange={goal.change}
        onSubmit={goal.submit}
        onCancel={goal.cancel}
      />
    );
  }
  if (goal.pace) return <GoalProgress status={data} pace={goal.pace} />;
  return <NoGoal onEdit={goal.startEditing} />;
}

/** "Meta do mês": deals and revenue against the goal, the pace, and "Editar meta". */
export function MonthlyGoalCard() {
  const goal = useMonthlyGoal();
  const { data } = goal;
  if (!data && !goal.failed) return null;
  return (
    <section aria-labelledby="monthly-goal" className="grouped enter flex flex-col">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-5 pt-4 pb-2">
        <h2 id="monthly-goal" className="text-lg font-semibold">
          Meta do mês
        </h2>
        {data ? (
          <span className="text-sm text-muted-foreground">{monthName(data.month)}</span>
        ) : null}
        <span className="min-w-0 flex-1" />
        {goal.goal && !goal.editing ? (
          <Button size="sm" variant="outline" onClick={goal.startEditing}>
            Editar meta
          </Button>
        ) : null}
      </div>
      <GoalBody goal={goal} />
    </section>
  );
}
