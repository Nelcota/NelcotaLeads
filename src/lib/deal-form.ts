import { parseMoneyInput } from "@/lib/money";
import { isCalendarDay, type CloseLostInput, type CloseWonInput } from "@/lib/schemas";

export type WonDeal = Omit<CloseWonInput, "id">;
export type LostDeal = Omit<CloseLostInput, "id">;

/** The "Fechar negócio" fields as typed. */
export type WonDealForm = { value: string; closedOn: string; service: string };

export type FormResult<T> = { ok: true; deal: T } | { ok: false; error: string };

const SERVICE_MAX = 120;

/** Checks the "Fechar negócio" fields; the server checks them again. */
export function wonDealFromForm(form: WonDealForm, today: string): FormResult<WonDeal> {
  const valueCents = parseMoneyInput(form.value);
  if (valueCents === null) return { ok: false, error: "Informe um valor maior que zero." };
  if (!isCalendarDay(form.closedOn)) return { ok: false, error: "Informe a data do fechamento." };
  if (form.closedOn > today) {
    return { ok: false, error: "A data do fechamento não pode ser no futuro." };
  }
  const service = form.service.trim();
  if (!service) return { ok: false, error: "Informe o serviço vendido." };
  if (service.length > SERVICE_MAX) return { ok: false, error: "Serviço: até 120 caracteres." };
  return { ok: true, deal: { valueCents, closedOn: form.closedOn, service } };
}
