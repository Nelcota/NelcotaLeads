import { TONE_TEXT } from "@/components/apple-ui";
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
          <h2 className="flex items-center justify-between gap-2 text-base font-semibold text-muted-foreground">
            <span className="flex items-center gap-2">
              <block.icon.glyph
                aria-hidden
                strokeWidth={2}
                className={cn("size-[18px] shrink-0", TONE_TEXT[block.icon.tone])}
              />
              {block.title}
            </span>
            <span className="text-sm font-normal text-tertiary">{caption}</span>
          </h2>
          {block.empty ? (
            <p className="flex min-h-[42px] items-end border-b border-border/60 pb-3 text-base text-muted-foreground">
              {block.empty}
            </p>
          ) : (
            <p className="flex items-baseline gap-2 border-b border-border/60 pb-3">
              <span className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
                {block.big}
              </span>
              <span className="text-sm text-muted-foreground">{block.caption}</span>
            </p>
          )}
          <dl className="grid gap-2">
            {block.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-base">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  {row.icon ? (
                    <row.icon.glyph
                      aria-hidden
                      strokeWidth={2}
                      className={cn("size-4 shrink-0", TONE_TEXT[row.icon.tone])}
                    />
                  ) : null}
                  {row.label}
                </dt>
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
