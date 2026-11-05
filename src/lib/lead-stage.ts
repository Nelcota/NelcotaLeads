import type { LeadStatus } from "@/db/schema";
import { SALES_STAGES, type SalesStage } from "@/lib/schemas";

/** The steps of the stage bar in the lead panel, in order. */
export const STAGE_STEPS = [
  "Novo",
  "Contatado",
  "Respondeu",
  "Reunião",
  "Proposta",
  "Fechado",
] as const;

const STATUS_STEP: Record<Exclude<LeadStatus, "discarded">, number> = {
  new: 0,
  contacted: 1,
  replied: 2,
  closed: 5,
};

const SALES_STAGE_STEP: Record<SalesStage, number> = { meeting: 3, proposal: 4 };

/**
 * The current step of the stage bar (an index into STAGE_STEPS), or null for a lead that ended
 * without a deal, which has no place on it. Meeting and proposal only count while it is replied.
 */
export function currentStageStep(status: LeadStatus, salesStage: SalesStage | null): number | null {
  if (status === "discarded") return null;
  if (status === "replied" && salesStage) return SALES_STAGE_STEP[salesStage];
  return STATUS_STEP[status];
}

/**
 * Whether the AI handed the conversation over because the lead asked about price: it never
 * quotes one, so the person answers with the proposal. The reason is the AI's own text.
 */
export function isPriceHandoff(reason: string | null): boolean {
  if (!reason) return false;
  return /pre[çc]o|valor|or[çc]amento|quanto custa|custo|investimento/i.test(reason);
}

/**
 * The sales stage a replied lead moves to from a step of the bar: Respondeu (null), Reunião or
 * Proposta. Undefined for the other steps, which change through their own actions.
 */
export function stageOfStep(step: number): SalesStage | null | undefined {
  const stage = SALES_STAGES.find((item) => SALES_STAGE_STEP[item] === step);
  if (stage) return stage;
  return step === STATUS_STEP.replied ? null : undefined;
}
