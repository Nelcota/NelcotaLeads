import { z } from "zod";
import { formatCents, MAX_DEAL_CENTS } from "./money";
import { idSchema } from "./schemas";
import { EXAMPLE_ADDONS, EXAMPLE_SERVICES } from "./service-examples";

/** Bounds of a row of the service table. */
export const SERVICE_LIMITS = { name: 80, detail: 200, scope: 80, deadlineDays: 365 } as const;

export const DEFAULT_ADDON_SCOPE = "Todos os sites";

const userText = () => z.string().normalize("NFC").trim();
const nameSchema = userText()
  .min(1, "Informe o nome")
  .max(SERVICE_LIMITS.name, `Nome: até ${SERVICE_LIMITS.name} caracteres`);
const priceSchema = z
  .number()
  .int()
  .positive("O preço precisa ser maior que zero")
  .max(MAX_DEAL_CENTS, "Preço alto demais");

const serviceFields = z.object({
  name: nameSchema,
  detail: userText().max(SERVICE_LIMITS.detail, `Detalhe: até ${SERVICE_LIMITS.detail} caracteres`),
  priceCents: priceSchema,
  monthly: z.boolean(),
  // Days to deliver; null for a monthly service.
  deadlineDays: z.number().int().min(1).max(SERVICE_LIMITS.deadlineDays).nullable(),
});

/** A one-off service has a deadline; a monthly one has none. */
function deadlineMatches(service: { monthly: boolean; deadlineDays: number | null }) {
  return service.monthly ? service.deadlineDays === null : service.deadlineDays !== null;
}
const DEADLINE_ISSUE = { message: "Informe o prazo em dias", path: ["deadlineDays"] };

export const serviceInputSchema = serviceFields.refine(deadlineMatches, DEADLINE_ISSUE);
export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceUpdateSchema = serviceFields
  .extend({ id: idSchema })
  .refine(deadlineMatches, DEADLINE_ISSUE);
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;

const addonFields = z.object({
  name: nameSchema,
  scope: userText().max(SERVICE_LIMITS.scope, `Vale para: até ${SERVICE_LIMITS.scope} caracteres`),
  priceCents: priceSchema,
  monthly: z.boolean(),
});

export const addonInputSchema = addonFields;
export type AddonInput = z.infer<typeof addonInputSchema>;

export const addonUpdateSchema = addonFields.extend({ id: idSchema });
export type AddonUpdate = z.infer<typeof addonUpdateSchema>;

type Priced = { priceCents: number; monthly: boolean };

/** "R$ 990", or "R$ 690/mês" for a monthly price. */
export function priceLabel({ priceCents, monthly }: Priced): string {
  const price = formatCents(priceCents);
  return monthly ? `${price}/mês` : price;
}

/** "10 dias", or "mensal". */
export function deadlineLabel(service: { monthly: boolean; deadlineDays: number | null }): string {
  if (service.monthly || service.deadlineDays === null) return "mensal";
  return service.deadlineDays === 1 ? "1 dia" : `${service.deadlineDays} dias`;
}

/** "R$ 990 · 10 dias" or "R$ 690/mês", as the proposal's service picker shows it. */
export function serviceTerms(service: Priced & { deadlineDays: number | null }): string {
  if (service.monthly) return priceLabel(service);
  return `${priceLabel(service)} · ${deadlineLabel(service)}`;
}

const sameRow = (row: Priced & { name: string }) => (example: Priced & { name: string }) =>
  example.name === row.name &&
  example.priceCents === row.priceCents &&
  example.monthly === row.monthly;

/**
 * Whether the table still holds only the seeded example prices: every row matches an example by
 * name, price and kind. Any real price typed in (or an empty table) ends the warning.
 */
export function usesExamplePrices(
  services: readonly (Priced & { name: string })[],
  addons: readonly (Priced & { name: string })[],
): boolean {
  if (services.length + addons.length === 0) return false;
  return (
    services.every((service) => EXAMPLE_SERVICES.some(sameRow(service))) &&
    addons.every((addon) => EXAMPLE_ADDONS.some(sameRow(addon)))
  );
}
