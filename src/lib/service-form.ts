import { firstIssue, type ParseResult } from "./form-result";
import { formatMoneyInput, parseMoneyInput } from "./money";
import {
  addonInputSchema,
  DEFAULT_ADDON_SCOPE,
  serviceInputSchema,
  type AddonInput,
  type ServiceInput,
} from "./services";

/** The fields of a service row as typed. */
export type ServiceForm = {
  name: string;
  detail: string;
  price: string;
  monthly: boolean;
  deadline: string;
};

/** The fields of an add-on row as typed. */
export type AddonForm = { name: string; scope: string; price: string; monthly: boolean };

export const EMPTY_SERVICE_FORM: ServiceForm = {
  name: "",
  detail: "",
  price: "",
  monthly: false,
  deadline: "",
};

export const EMPTY_ADDON_FORM: AddonForm = {
  name: "",
  scope: DEFAULT_ADDON_SCOPE,
  price: "",
  monthly: false,
};

const PRICE_ERROR = "Informe um preço maior que zero.";

/** Checks a service row; the server checks it again with the same schema. */
export function serviceFromForm(form: ServiceForm): ParseResult<ServiceInput> {
  const priceCents = parseMoneyInput(form.price);
  if (priceCents === null) return { ok: false, error: PRICE_ERROR };
  const deadline = form.deadline.trim();
  const deadlineDays = form.monthly || !deadline ? null : Number(deadline);
  if (deadlineDays !== null && !Number.isInteger(deadlineDays)) {
    return { ok: false, error: "Informe o prazo em dias inteiros." };
  }
  const parsed = serviceInputSchema.safeParse({
    name: form.name,
    detail: form.detail,
    priceCents,
    monthly: form.monthly,
    deadlineDays,
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  return { ok: true, value: parsed.data };
}

/** Checks an add-on row; the server checks it again with the same schema. */
export function addonFromForm(form: AddonForm): ParseResult<AddonInput> {
  const priceCents = parseMoneyInput(form.price);
  if (priceCents === null) return { ok: false, error: PRICE_ERROR };
  const parsed = addonInputSchema.safeParse({
    name: form.name,
    scope: form.scope || DEFAULT_ADDON_SCOPE,
    priceCents,
    monthly: form.monthly,
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  return { ok: true, value: parsed.data };
}

/** A stored service as form fields, for "Editar". */
export function serviceToForm(service: ServiceInput): ServiceForm {
  return {
    name: service.name,
    detail: service.detail,
    price: formatMoneyInput(service.priceCents),
    monthly: service.monthly,
    deadline: service.deadlineDays === null ? "" : String(service.deadlineDays),
  };
}

/** A stored add-on as form fields, for "Editar". */
export function addonToForm(addon: AddonInput): AddonForm {
  return {
    name: addon.name,
    scope: addon.scope,
    price: formatMoneyInput(addon.priceCents),
    monthly: addon.monthly,
  };
}

/** Whether a row's form still holds what it opened with (every field is a plain value). */
export function sameFields<T extends Record<string, string | boolean>>(a: T, b: T): boolean {
  return Object.keys(a).every((key) => a[key] === b[key]);
}
