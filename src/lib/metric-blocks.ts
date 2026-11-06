import type { Dashboard } from "@/server/dashboard";
import type { OverviewMetrics } from "@/server/overview-metrics";
import { formatCents } from "./money";
import {
  averageTicket,
  closingRateLabel,
  costPerDeal,
  formatUsd,
  percentLabel,
} from "./overview-metrics";

export type MetricTone = "red" | "orange" | "green";

export type MetricRow = { label: string; value: string | number; tone?: MetricTone };

export type MetricBlock = {
  title: string;
  big: string | number;
  caption: string;
  rows: MetricRow[];
};

const toneWhen = (condition: boolean, tone: MetricTone) => (condition ? tone : undefined);

function sendingBlock(data: Dashboard, metrics: OverviewMetrics): MetricBlock {
  const { mail } = data;
  const { funnel, sending } = metrics;
  return {
    title: "Envio",
    big: funnel.contacted,
    caption: "leads contatados",
    rows: [
      { label: "E-mails hoje", value: `${mail.sentToday} de ${mail.limit}` },
      { label: "Na fila", value: mail.queued },
      {
        label: "Falharam hoje",
        value: mail.failedToday,
        tone: toneWhen(mail.failedToday > 0, "red"),
      },
      {
        label: "Voltaram (bounce)",
        value: `${sending.bounced} · ${percentLabel(sending.bounced, sending.sent)}`,
        tone: toneWhen(sending.bounced > 0, "orange"),
      },
      { label: "Pediram descadastro", value: sending.unsubscribed },
    ],
  };
}

function replyBlock(data: Dashboard, metrics: OverviewMetrics): MetricBlock {
  const { funnel } = metrics;
  return {
    title: "Resposta",
    big: percentLabel(funnel.replied, funnel.contacted),
    caption: "responderam",
    rows: [
      { label: "Responderam", value: funnel.replied },
      { label: "IA conversando agora", value: data.stats.aiTalking },
      {
        label: "Precisam de você agora",
        value: data.stats.interested,
        tone: toneWhen(data.stats.interested > 0, "orange"),
      },
    ],
  };
}

function businessBlock(metrics: OverviewMetrics): MetricBlock {
  const { business, funnel } = metrics;
  const ticket = averageTicket(business.revenueCents, business.won);
  const perDeal = costPerDeal(business.aiCostUsd, business.won);
  return {
    title: "Negócio",
    big: business.won,
    caption: business.won === 1 ? "fechado" : "fechados",
    rows: [
      { label: "Receita", value: formatCents(business.revenueCents) },
      { label: "Ticket médio", value: ticket === null ? "—" : formatCents(ticket) },
      // Of the leads first contacted in the period, so it stays within 100%.
      { label: "Taxa de fechamento", value: closingRateLabel(funnel.won, funnel.contacted) },
      { label: "Perdidos", value: business.lost, tone: toneWhen(business.lost > 0, "red") },
      { label: "Custo da IA por fechamento", value: perDeal === null ? "—" : formatUsd(perDeal) },
    ],
  };
}

/**
 * Sending, replies and business for the period. What happens "today" or "agora" (the queue,
 * failures, conversations waiting) is shown as it stands, whatever the period.
 */
export function metricBlocks(data: Dashboard, metrics: OverviewMetrics): MetricBlock[] {
  return [sendingBlock(data, metrics), replyBlock(data, metrics), businessBlock(metrics)];
}
