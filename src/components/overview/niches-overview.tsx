import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNicheMetrics } from "@/hooks/use-niche-metrics";
import { nicheCaption, nicheTags, tagsOf } from "@/lib/niche-metrics";
import type { OverviewPeriod } from "@/lib/period";
import { cn } from "@/lib/utils";
import { NicheCard } from "./niche-card";

/** Niches shown before "Ver todos": one row of cards on a wide screen. */
const VISIBLE_NICHES = 3;

const GRID_COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
} as const;

/** Columns for the cards on screen: as many as niches, up to one full row. */
function gridColumns(count: number): string {
  if (count <= 1) return GRID_COLUMNS[1];
  if (count === 2) return GRID_COLUMNS[2];
  return GRID_COLUMNS[3];
}

/**
 * "Por nicho": a card per niche, the most active first (the server's order). The first three
 * show; "Ver todos os N nichos" opens the rest in place.
 */
export function NichesOverview({ period, caption }: { period: OverviewPeriod; caption: string }) {
  const { niches, loading, error } = useNicheMetrics(period);
  const [expanded, setExpanded] = useState(false);
  if (loading) return <Skeleton className="h-72 rounded-[20px]" />;
  if (error) {
    return (
      <section aria-labelledby="niches" className="grouped px-5 py-4">
        <h2 id="niches" className="text-lg font-semibold">
          Por nicho
        </h2>
        <p className="pt-2 text-sm text-muted-foreground">
          Não foi possível carregar os nichos. Recarregue a página para tentar de novo.
        </p>
      </section>
    );
  }
  if (niches.length === 0) return null;
  const tags = nicheTags(niches);
  const hasMore = niches.length > VISIBLE_NICHES;
  const visible = expanded ? niches : niches.slice(0, VISIBLE_NICHES);
  return (
    <section
      aria-labelledby="niches"
      className="grouped enter flex min-w-0 flex-col gap-4 px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="niches" className="text-lg font-semibold">
          Por nicho
        </h2>
        {/* On a phone the caption takes its own line under the title and the button. */}
        <span className="min-w-0 text-sm text-muted-foreground max-sm:order-last max-sm:basis-full sm:flex-1">
          {caption} · {nicheCaption(niches, tags.mostCloses)}
        </span>
        {hasMore ? (
          <Button
            size="sm"
            variant="outline"
            className="max-sm:ml-auto"
            aria-expanded={expanded}
            aria-controls="niches-grid"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Mostrar menos" : `Ver todos os ${niches.length} nichos`}
          </Button>
        ) : null}
      </div>
      <div id="niches-grid" className={cn("grid gap-4", gridColumns(niches.length))}>
        {visible.map((niche) => (
          <NicheCard key={niche.key} niche={niche} tags={tagsOf(niche.key, tags)} />
        ))}
      </div>
    </section>
  );
}
