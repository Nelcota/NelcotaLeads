import { HistoryIcon } from "@/components/icons";
import type { Search } from "@/db/schema";
import { previousSearchText } from "@/lib/previous-search";

/**
 * Under "Buscar empresas": the niche and city typed were searched before, and how that went,
 * so the quota is not spent again on a place that already gave what it had. Only informs.
 */
export function RepeatSearchNotice({ previous }: { previous: Search | null }) {
  return (
    // Always in the page, so screen readers announce the text when it appears; while empty it
    // takes back the form's gap so the card does not grow.
    <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground empty:-mt-4">
      {previous ? (
        <>
          <HistoryIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
          {previousSearchText(previous)}
        </>
      ) : null}
    </p>
  );
}
