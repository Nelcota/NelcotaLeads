import {
  HandIcon,
  HandshakeIcon,
  MailIcon,
  MessageCircleIcon,
  SparklesIcon,
  type IconComponent,
} from "@/components/icons";
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

/** A bare line icon in its status color, shown before a title or a row label. */
export type MetricIcon = { glyph: IconComponent; tone: "blue" | "green" | "purple" | "orange" };

export type MetricRow = {
  label: string;
  value: string | number;
  tone?: MetricTone;
  icon?: MetricIcon;
};

export type MetricBlock = {
  title: string;
  icon: MetricIcon;
  big: string | number;
  caption: string;
  /** Shown instead of the headline number when the period has no base for it. */
  empty?: string;
  rows: MetricRow[];
};

const toneWhen = (condition: boolean, tone: MetricTone) => (condition ? tone : undefined);

function sendingBlock(data: Dashboard, metrics: OverviewMetrics): MetricBlock {
  const { mail } = data;
  const { funnel, sending } = metrics;
  return {
    title: "Envio",
    icon: { glyph: MailIcon, tone: "blue" },
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

const REPLY_ICON: MetricIcon = { glyph: MessageCircleIcon, tone: "blue" };

type ReplyStats = Pick<Dashboard["stats"], "aiTalking" | "interested">;
type ReplyFunnel = Pick<OverviewMetrics["funnel"], "contacted" | "replied">;

/** What stands "agora", whatever the period. */
function replyNowRows(stats: ReplyStats): MetricRow[] {
  return [
    {
      label: "IA conversando agora",
      value: stats.aiTalking,
      icon: { glyph: SparklesIcon, tone: "purple" },
    },
    {
      label: "Precisam de você agora",
      icon: { glyph: HandIcon, tone: "orange" },
      value: stats.interested,
      tone: toneWhen(stats.interested > 0, "orange"),
    },
  ];
}

/**
 * Of the leads first contacted in the period, how many replied (whenever they did): the caption
 * says so, since "Quando os leads respondem" counts every reply received instead.
 */
export function replyBlock(stats: ReplyStats, funnel: ReplyFunnel): MetricBlock {
  if (funnel.contacted <= 0) {
    return {
      title: "Resposta",
      icon: REPLY_ICON,
      big: "",
      caption: "",
      empty: "Ninguém contatado no período",
      rows: replyNowRows(stats),
    };
  }
  return {
    title: "Resposta",
    icon: REPLY_ICON,
    big: percentLabel(funnel.replied, funnel.contacted),
    caption: "dos contatados no período responderam",
    rows: [
      { label: "Responderam", value: `${funnel.replied} de ${funnel.contacted}` },
      ...replyNowRows(stats),
    ],
  };
}

function businessBlock(metrics: OverviewMetrics): MetricBlock {
  const { business, funnel } = metrics;
  const ticket = averageTicket(business.revenueCents, business.won);
  const perDeal = costPerDeal(business.aiCostUsd, business.won);
  return {
    title: "Negócio",
    icon: { glyph: HandshakeIcon, tone: "green" },
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
  return [
    sendingBlock(data, metrics),
    replyBlock(data.stats, metrics.funnel),
    businessBlock(metrics),
  ];
}
