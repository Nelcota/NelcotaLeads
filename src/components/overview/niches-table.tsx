import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatCents } from "@/lib/money";
import { nicheTags, ratePercent } from "@/lib/overview-metrics";
import type { OverviewPeriod } from "@/lib/period";
import { nicheMetricsQuery } from "@/lib/queries";
import { LOSS_REASON_LABELS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { NicheMetricRow } from "@/server/niches";

const GRID =
  "grid grid-cols-[minmax(0,1fr)_repeat(3,60px)] items-center gap-2 px-5 sm:grid-cols-[minmax(0,1fr)_repeat(4,84px)_96px] lg:grid-cols-[minmax(0,1fr)_56px_repeat(4,84px)_96px_minmax(0,150px)] sm:gap-3";

type Tone = "blue" | "green" | "red";

const TONE_CLASS: Record<Tone, string> = {
  blue: "text-blue",
  green: "text-green",
  red: "text-red",
};

/**
 * "12 · 40%": a count and, when given, a share of `of` ("–" without a base). The share is of
 * `part` when given (the contacted cohort's own count), else of `value`.
 */
function Cell({
  value,
  part,
  of,
  tone,
  className,
}: {
  value: number;
  part?: number;
  of?: number;
  tone?: Tone;
  className?: string;
}) {
  const percent = of !== undefined ? ratePercent(part ?? value, of) : null;
  return (
    <span className={cn("text-right tabular-nums", className)}>
      <span
        className={cn("font-semibold", value === 0 ? "text-tertiary" : tone && TONE_CLASS[tone])}
      >
        {value}
      </span>
      {of !== undefined ? (
        <span className="ml-1 text-[12px] text-tertiary">
          {percent !== null ? `${percent}%` : "–"}
        </span>
      ) : null}
    </span>
  );
}

function Tag({ tone, children }: { tone: "green" | "red"; children: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-px text-[11.5px] font-semibold",
        tone === "green" ? "bg-green/16 text-green" : "bg-red/16 text-red",
      )}
    >
      {children}
    </span>
  );
}

function Header() {
  return (
    <div className={cn(GRID, "py-2 text-[12.5px] font-semibold text-tertiary")}>
      <span>Nicho</span>
      <span className="text-right max-lg:hidden">Leads</span>
      <span className="text-right max-sm:hidden">Contatados</span>
      <span className="text-right">Responderam</span>
      <span className="text-right">Fecharam</span>
      <span className="text-right">Recusaram</span>
      <span className="text-right max-sm:hidden">Receita</span>
      <span className="max-lg:hidden">Motivo de perda mais comum</span>
    </div>
  );
}

function NicheRow({ niche, tags }: { niche: NicheMetricRow; tags: ReturnType<typeof nicheTags> }) {
  return (
    <Link
      to="/leads"
      search={{ view: "all", niche: niche.key }}
      aria-label={`${niche.label}: ${niche.contacted} contatados, ${niche.replied} responderam, ${niche.won} fecharam, ${niche.lost} recusaram`}
      className={cn(
        GRID,
        "min-h-[48px] border-t border-border/60 py-2 transition-colors outline-none hover:bg-fill-3 focus-visible:bg-fill-2",
      )}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="truncate font-semibold">{niche.label}</span>
        {tags.mostCloses === niche.key ? <Tag tone="green">mais fecha</Tag> : null}
        {tags.mostRefuses === niche.key ? <Tag tone="red">mais recusa</Tag> : null}
      </span>
      <span className="text-right tabular-nums max-lg:hidden">{niche.leads}</span>
      <Cell value={niche.contacted} className="max-sm:hidden" />
      <Cell value={niche.replied} of={niche.contacted} tone="blue" />
      {/* The count is of the period; the % is of the leads contacted in it (within 100%). */}
      <Cell value={niche.won} part={niche.cohortWon} of={niche.contacted} tone="green" />
      <Cell value={niche.lost} part={niche.cohortLost} of={niche.contacted} tone="red" />
      <span className="text-right font-semibold tabular-nums max-sm:hidden">
        {niche.revenueCents > 0 ? (
          formatCents(niche.revenueCents)
        ) : (
          <span className="text-tertiary">—</span>
        )}
      </span>
      <span className="truncate text-[13.5px] text-muted-foreground max-lg:hidden">
        {niche.topLossReason ? LOSS_REASON_LABELS[niche.topLossReason] : "—"}
      </span>
    </Link>
  );
}

/** The funnel of the period split by niche: which areas answer, buy and refuse the most. */
export function NichesTable({ period, caption }: { period: OverviewPeriod; caption: string }) {
  const { data: niches } = useQuery(nicheMetricsQuery(period));
  if (!niches || niches.length === 0) return null;
  const tags = nicheTags(niches);
  const best = niches.find((niche) => niche.key === tags.mostCloses);
  return (
    <section aria-labelledby="niches" className="grouped enter min-w-0 py-4">
      <div className="flex flex-wrap items-baseline gap-2 px-5 pb-2">
        <h2 id="niches" className="text-[17px] font-semibold">
          Por nicho
        </h2>
        <span className="text-sm text-muted-foreground">
          {caption} ·{" "}
          {best
            ? `${best.label} é quem mais fecha.`
            : "quem responde, fecha e recusa mais, por área."}
        </span>
      </div>
      <Header />
      {niches.map((niche) => (
        <NicheRow key={niche.key} niche={niche} tags={tags} />
      ))}
    </section>
  );
}
