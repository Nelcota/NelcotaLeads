import {
  costPerDeal,
  formatUsd,
  ratePercent,
  replyRateLabel,
  type ReplyRate,
} from "@/lib/overview-metrics";
import type { OverviewMetrics } from "@/server/overview-metrics";
import { ProgressBar } from "./progress-bar";

function AuthorRow({ title, rate }: { title: string; rate: ReplyRate }) {
  const percent = ratePercent(rate.replied, rate.sent);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="font-semibold">{title}</span>
        <span className="text-right tabular-nums">
          <span className="font-semibold">{percent === null ? "—" : `${percent}%`}</span>
          <span className="ml-1.5 text-[12.5px] text-tertiary">{replyRateLabel(rate)}</span>
        </span>
      </div>
      <ProgressBar share={(percent ?? 0) / 100} label={`${title}: ${replyRateLabel(rate)}`} />
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="text-[17px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * "IA × escrito à mão": how often a first e-mail gets an answer when the AI wrote it and when
 * a person did, in the period; and what the AI costs this month.
 */
export function AiVsHandCard({ metrics, caption }: { metrics: OverviewMetrics; caption: string }) {
  const { authors, aiMonth } = metrics;
  const perDeal = costPerDeal(aiMonth.costUsd, aiMonth.won);
  return (
    <section aria-labelledby="ai-vs-hand" className="grouped enter flex min-w-0 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="ai-vs-hand" className="text-[17px] font-semibold">
          IA × escrito à mão
        </h2>
        <span className="text-sm text-muted-foreground">
          respostas ao primeiro e-mail · {caption}
        </span>
      </div>
      <div className="grid gap-4">
        <AuthorRow title="Escrito pela IA" rate={authors.ai} />
        <AuthorRow title="Escrito por uma pessoa" rate={authors.user} />
      </div>
      <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-border/60 pt-3">
        <CostRow label="IA no mês" value={formatUsd(aiMonth.costUsd)} />
        <CostRow label="Projeção do mês" value={formatUsd(aiMonth.projectionUsd)} />
        <CostRow label="Por fechamento" value={perDeal === null ? "—" : formatUsd(perDeal)} />
      </dl>
    </section>
  );
}
