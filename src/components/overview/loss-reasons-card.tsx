import { CircleXIcon } from "@/components/icons";
import { lossBreakdown, type LossCount } from "@/lib/overview-metrics";
import { ProgressBar } from "./progress-bar";

/**
 * "Por que não fecharam": the loss reasons used in the period, most common first, with count,
 * share and bar. Reasons nobody gave stay out, so the list holds only what happened.
 */
export function LossReasonsCard({ losses, caption }: { losses: LossCount[]; caption: string }) {
  const { total, bars } = lossBreakdown(losses);
  return (
    <section
      aria-labelledby="loss-reasons"
      className="grouped enter flex min-w-0 flex-col gap-3 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="loss-reasons" className="flex items-center gap-2 text-lg font-semibold">
          <CircleXIcon aria-hidden className="size-[18px] shrink-0 text-red" />
          Por que não fecharam
        </h2>
        <span className="text-sm text-muted-foreground">
          {caption} · {total === 1 ? "1 perdido" : `${total} perdidos`}
        </span>
      </div>
      {total === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Nenhum lead encerrado sem negócio neste período.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {bars.map((bar) => (
            <li
              key={bar.reason}
              className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_72px] items-center gap-3 text-base sm:grid-cols-[minmax(0,190px)_minmax(0,1fr)_80px]"
            >
              <span className="leading-snug text-muted-foreground">{bar.label}</span>
              <ProgressBar share={bar.share} tone="red" label={`${bar.label}: ${bar.count}`} />
              <span className="text-right tabular-nums">
                <span className="font-semibold">{bar.count}</span>
                <span className="ml-1 text-xs text-tertiary">{bar.percent}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
