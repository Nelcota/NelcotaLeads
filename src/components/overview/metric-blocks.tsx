import type { MetricBlock } from "@/lib/metric-blocks";
import { cn } from "@/lib/utils";

const TONE_CLASS = { red: "text-red", orange: "text-orange", green: "text-green" } as const;

/** Sending, replies and business in three blocks, each with its headline number on top. */
export function MetricBlocks({ blocks, caption }: { blocks: MetricBlock[]; caption: string }) {
  return (
    <section aria-label={`Métricas, ${caption}`} className="grid gap-3 md:grid-cols-3">
      {blocks.map((block, index) => (
        <div
          key={block.title}
          className="grouped enter flex flex-col gap-3 p-5"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <h2 className="flex items-baseline justify-between gap-2 text-[15px] font-semibold text-muted-foreground">
            {block.title}
            <span className="text-[12.5px] font-normal text-tertiary">{caption}</span>
          </h2>
          <p className="flex items-baseline gap-2 border-b border-border/60 pb-3">
            <span className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
              {block.big}
            </span>
            <span className="text-sm text-muted-foreground">{block.caption}</span>
          </p>
          <dl className="grid gap-2">
            {block.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 text-[14px]"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className={cn("font-semibold tabular-nums", row.tone && TONE_CLASS[row.tone])}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
