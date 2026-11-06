import { z } from "zod";
import { firstIssue, type ParseResult } from "./form-result";
import { addDays } from "./format";
import { formatMoneyInput, MAX_DEAL_CENTS, parseMoneyInput } from "./money";
import { dayRange, type DayRange } from "./period";

/** Most deals a monthly goal may ask for; far above what the team closes. */
export const MAX_GOAL_DEALS = 1000;

/** "Editar meta": deals and revenue for the month, saved from the current month on. */
export const monthlyGoalInputSchema = z.object({
  deals: z
    .number()
    .int("Use um número inteiro de fechamentos.")
    .min(1, "A meta precisa de pelo menos 1 fechamento.")
    .max(MAX_GOAL_DEALS, `Use no máximo ${MAX_GOAL_DEALS} fechamentos.`),
  revenueCents: z
    .number()
    .int()
    .min(1, "Informe a receita do mês.")
    .max(MAX_DEAL_CENTS, "Receita alta demais."),
});
export type MonthlyGoalInput = z.infer<typeof monthlyGoalInputSchema>;

/** What the two fields of "Editar meta" hold, as typed. */
export type GoalFormValues = { deals: string; revenue: string };

/** The typed fields as a goal to save, or the first problem in words. */
export function parseGoalForm(values: GoalFormValues): ParseResult<MonthlyGoalInput> {
  const deals = values.deals.trim();
  if (!/^\d+$/.test(deals)) return { ok: false, error: "Informe quantos fechamentos no mês." };
  const revenueCents = parseMoneyInput(values.revenue);
  if (revenueCents === null) return { ok: false, error: "Informe a receita do mês em reais." };
  const parsed = monthlyGoalInputSchema.safeParse({ deals: Number(deals), revenueCents });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  return { ok: true, value: parsed.data };
}

/** `YYYY-MM` of a `YYYY-MM-DD` day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** How many days a `YYYY-MM` month has. */
export function daysInMonth(month: string): number {
  const [year = 0, monthNumber = 0] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** The whole `YYYY-MM` month in Brazil time. */
export function monthRange(month: string): DayRange {
  return dayRange(`${month}-01`, addDays(`${month}-01`, daysInMonth(month) - 1));
}

/** Days of the month gone by, today included (1 on the first day). */
export function daysElapsed(today: string): number {
  return Number(today.slice(8, 10));
}

/** Days left in the month, today included (1 on the last day). */
export function daysLeft(today: string): number {
  return daysInMonth(monthOf(today)) - daysElapsed(today) + 1;
}

export type GoalTargets = { deals: number; revenueCents: number };
export type GoalProgress = { deals: number; revenueCents: number };

/** A share of a target in whole percent, capped at 100 for the bar. */
export function progressPercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

export type GoalPace = {
  dealsPercent: number;
  revenuePercent: number;
  remainingDeals: number;
  daysLeft: number;
  /** Deals per week at the pace of the month so far. */
  weeklyPace: number;
};

/** Where the month stands against its goal on `today`. */
export function goalPace(goal: GoalTargets, progress: GoalProgress, today: string): GoalPace {
  return {
    dealsPercent: progressPercent(progress.deals, goal.deals),
    revenuePercent: progressPercent(progress.revenueCents, goal.revenueCents),
    remainingDeals: Math.max(0, goal.deals - progress.deals),
    daysLeft: daysLeft(today),
    weeklyPace: (progress.deals / daysElapsed(today)) * 7,
  };
}

const oneDecimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "Faltam 4 fechamentos em 12 dias · no ritmo atual, 1,5 por semana". */
export function paceLine(
  pace: Pick<GoalPace, "remainingDeals" | "daysLeft" | "weeklyPace">,
): string {
  if (pace.remainingDeals === 0) return "Meta de fechamentos batida neste mês.";
  const deals =
    pace.remainingDeals === 1 ? "Falta 1 fechamento" : `Faltam ${pace.remainingDeals} fechamentos`;
  const days = pace.daysLeft === 1 ? "1 dia" : `${pace.daysLeft} dias`;
  return `${deals} em ${days} · no ritmo atual, ${oneDecimal.format(pace.weeklyPace)} por semana`;
}

/** Cost so far stretched over the whole month at the same daily pace. */
export function monthProjection(costSoFar: number, today: string): number {
  return (costSoFar / daysElapsed(today)) * daysInMonth(monthOf(today));
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** "novembro" of `2026-11`. */
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

/** The fields of "Editar meta", filled with the goal in force (empty without one). */
export function goalFormValues(goal: GoalTargets | null): GoalFormValues {
  if (!goal) return { deals: "", revenue: "" };
  return { deals: String(goal.deals), revenue: formatMoneyInput(goal.revenueCents) };
}
