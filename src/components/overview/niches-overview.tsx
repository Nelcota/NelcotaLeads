import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { nicheTags } from "@/lib/overview-metrics";
import type { OverviewPeriod } from "@/lib/period";
import { nicheMetricsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { NicheMetricRow } from "@/server/niches";
import { NicheCard, type NicheTag } from "./niche-card";

/** Niches shown before "Ver todos": one row of cards on a wide screen. */
const VISIBLE_NICHES = 3;

const GRID_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

function tagOf(key: string, tags: ReturnType<typeof nicheTags>): NicheTag {
  if (tags.mostCloses === key) return "mostCloses";
  if (tags.mostRefuses === key) return "mostRefuses";
  return null;
}

function captionOf(niches: readonly NicheMetricRow[], best: string | null): string {
  const leader = niches.find((niche) => niche.key === best);
  if (!leader) return "quem responde, fecha e recusa mais, por área.";
  return `${leader.label} é quem mais fecha.`;
}

/**
 * "Por nicho": a card per niche, the ones that close the most first (the server's order). The
 * first three show; "Ver todos os N nichos" opens the rest in place.
 */
export function NichesOverview({ period, caption }: { period: OverviewPeriod; caption: string }) {
  const { data: niches } = useQuery(nicheMetricsQuery(period));
  const [expanded, setExpanded] = useState(false);
  if (!niches || niches.length === 0) return null;
  const tags = nicheTags(niches);
  const hasMore = niches.length > VISIBLE_NICHES;
  const visible = expanded ? niches : niches.slice(0, VISIBLE_NICHES);
  const columns = GRID_COLUMNS[Math.min(niches.length, VISIBLE_NICHES)];
  return (
    <section
      aria-labelledby="niches"
      className="grouped enter flex min-w-0 flex-col gap-4 px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="niches" className="text-[18px] font-semibold">
          Por nicho
        </h2>
        {/* On a phone the caption takes its own line under the title and the button. */}
        <span className="min-w-0 text-sm text-muted-foreground max-sm:order-last max-sm:basis-full sm:flex-1">
          {caption} · {captionOf(niches, tags.mostCloses)}
        </span>
        {hasMore ? (
          <Button
            size="sm"
            variant="secondary"
            className="max-sm:ml-auto"
            aria-expanded={expanded}
            aria-controls="niches-grid"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Mostrar menos" : `Ver todos os ${niches.length} nichos`}
          </Button>
        ) : null}
      </div>
      <div id="niches-grid" className={cn("grid gap-4", columns)}>
        {visible.map((niche) => (
          <NicheCard key={niche.key} niche={niche} tag={tagOf(niche.key, tags)} />
        ))}
      </div>
    </section>
  );
}
