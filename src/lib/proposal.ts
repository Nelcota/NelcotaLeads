import { z } from "zod";
import type { EmailStatus } from "@/db/schema";
import { firstIssue, type ParseResult } from "./form-result";
import { formatCents, formatMoneyInput, MAX_DEAL_CENTS, parseMoneyInput } from "./money";
import { idSchema, type ProposalItem } from "./schemas";
import { SERVICE_LIMITS } from "./services";

/** Days a proposal is valid for (decided 2026-11-03). */
export const PROPOSAL_VALID_DAYS = 15;

/** Bounds of a proposal: how many add-ons and "Pedido do cliente" lines it may carry. */
export const PROPOSAL_LIMITS = { addons: 20, custom: 10 } as const;

const customLineSchema = z.object({
  label: z
    .string()
    .normalize("NFC")
    .trim()
    .min(1, "Descreva o pedido do cliente")
    .max(SERVICE_LIMITS.name, `Pedido: até ${SERVICE_LIMITS.name} caracteres`),
  priceCents: z
    .number()
    .int()
    .positive("O valor do pedido precisa ser maior que zero")
    .max(MAX_DEAL_CENTS, "Valor alto demais"),
});
export type CustomLine = z.infer<typeof customLineSchema>;

/**
 * "Montar proposta": a service and add-ons from the table (by id, so the prices come from the
 * table, never from the browser) plus the client's own requests with their prices.
 */
export const proposalInputSchema = z.object({
  leadId: idSchema,
  serviceId: idSchema,
  addonIds: z.array(idSchema).max(PROPOSAL_LIMITS.addons),
  custom: z.array(customLineSchema).max(PROPOSAL_LIMITS.custom),
  sendEmail: z.boolean(),
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;
export type ProposalDraft = Omit<ProposalInput, "leadId" | "sendEmail">;

type TableRow = { name: string; priceCents: number; monthly: boolean };

/** The proposal's lines: the service first, then the add-ons, then the client's requests. */
export function buildProposalItems(
  service: TableRow,
  addons: readonly TableRow[],
  custom: readonly CustomLine[],
): ProposalItem[] {
  const fromTable = (kind: "service" | "addon") => (row: TableRow) => ({
    kind,
    label: row.name,
    priceCents: row.priceCents,
    monthly: row.monthly,
  });
  return [
    fromTable("service")(service),
    ...addons.map(fromTable("addon")),
    ...custom.map((line) => ({
      kind: "custom" as const,
      label: line.label,
      priceCents: line.priceCents,
      monthly: false,
    })),
  ];
}

const sumPrices = (rows: readonly ProposalItem[]) =>
  rows.reduce((total, item) => total + item.priceCents, 0);

/** The total (every line, monthly ones counted once) and the part that repeats every month. */
export function proposalTotals(items: readonly ProposalItem[]) {
  return {
    totalCents: sumPrices(items),
    monthlyCents: sumPrices(items.filter((item) => item.monthly)),
  };
}

/** A "Pedido do cliente" line as typed. */
export type CustomLineForm = { key: string; label: string; price: string };

/** Checks the client's requests in the browser; the server checks them again. */
export function customLinesFromForm(lines: readonly CustomLineForm[]): ParseResult<CustomLine[]> {
  const parsed: CustomLine[] = [];
  for (const line of lines) {
    const priceCents = parseMoneyInput(line.price);
    if (priceCents === null) {
      return { ok: false, error: "Informe o valor de cada pedido do cliente." };
    }
    const result = customLineSchema.safeParse({ label: line.label, priceCents });
    if (!result.success) return { ok: false, error: firstIssue(result.error.issues) };
    parsed.push(result.data);
  }
  return { ok: true, value: parsed };
}

/** What "Fechar negócio" starts with when the lead has a proposal: its total and service. */
export function wonPrefill(proposal: { items: ProposalItem[]; totalCents: number } | null) {
  if (!proposal) return null;
  const service = proposal.items.find((item) => item.kind === "service");
  return { value: formatMoneyInput(proposal.totalCents), service: service?.label ?? "" };
}

type PickableRow = TableRow & { id: string };

/**
 * The lines as the form stands, for the live total and "Ver como o cliente vê": requests still
 * missing a valid label or value are left out. Null until a service is picked.
 */
export function previewItems(
  table: { services: readonly PickableRow[]; addons: readonly PickableRow[] },
  picked: {
    serviceId: string | null;
    addonIds: readonly string[];
    lines: readonly CustomLineForm[];
  },
): ProposalItem[] | null {
  const service = table.services.find((row) => row.id === picked.serviceId);
  if (!service) return null;
  const addons = table.addons.filter((row) => picked.addonIds.includes(row.id));
  const custom = picked.lines.flatMap((line) => {
    const priceCents = parseMoneyInput(line.price);
    const label = line.label.trim();
    return priceCents !== null && label ? [{ label, priceCents }] : [];
  });
  return buildProposalItems(service, addons, custom);
}

const PROPOSAL_EMAIL_LABELS: Partial<Record<EmailStatus, string>> = {
  queued: "na fila de envio",
  sent: "enviada por e-mail",
  failed: "o e-mail falhou",
  cancelled: "o e-mail foi cancelado",
};

/**
 * "Última proposta: R$ 1.490 · na fila de envio": what the lead got, read from the e-mail's own
 * status, so a proposal is never called sent before it actually went out.
 */
export function proposalStatusLine(proposal: {
  totalCents: number;
  /** The status of the e-mail that carries it; null when it was not e-mailed. */
  emailStatus: EmailStatus | null;
}): string {
  const status = proposal.emailStatus ? PROPOSAL_EMAIL_LABELS[proposal.emailStatus] : undefined;
  const total = `Última proposta: ${formatCents(proposal.totalCents)}`;
  return status ? `${total} · ${status}` : `${total} · não foi por e-mail`;
}
