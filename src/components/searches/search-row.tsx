import { BotIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { SearchDetails } from "@/components/searches/search-details";
import { SearchResult } from "@/components/searches/search-result";
import { SearchRowActions } from "@/components/searches/search-row-actions";
import { SearchRowMenu } from "@/components/searches/search-row-menu";
import { SearchStatusText } from "@/components/searches/search-status";
import type { Search } from "@/db/schema";
import { dayMonth, formatDate, localDay, localTime } from "@/lib/format";
import { searchFailureText } from "@/lib/provider-errors";
import { isSearchRunning } from "@/lib/search-list";
import { searchLabel } from "@/lib/searches";
import { useToday } from "@/lib/today";

/**
 * One search in the Histórico card: date, what was searched, what it brought, its status and
 * actions. One line when the card is wide; on a narrow card the rest stacks under the title.
 */
export function SearchRow({
  search,
  quotaSpent,
  onFill,
}: {
  search: Search;
  quotaSpent: boolean;
  onFill: (niche: string, city: string) => void;
}) {
  const today = useToday();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const automatic = search.origin === "autopilot";
  const OriginIcon = automatic ? BotIcon : SearchIcon;
  const failure =
    search.status === "error"
      ? searchFailureText(search.errorMessage, search.createdAt, today)
      : null;

  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 gap-y-2 px-5 py-4 @4xl:grid-cols-[64px_20px_minmax(0,1fr)_170px_112px_272px] @4xl:items-center @4xl:gap-x-4">
      <p className="hidden flex-col text-sm tabular-nums @4xl:flex">
        <span className="font-medium">{dayMonth(localDay(search.createdAt))}</span>
        <span className="text-tertiary">{localTime(search.createdAt)}</span>
      </p>
      <OriginIcon
        aria-hidden
        strokeWidth={1.8}
        className="mt-0.5 size-5 text-muted-foreground @4xl:mt-0"
      />
      <div className="min-w-0">
        <p className="line-clamp-2 font-semibold text-pretty">{searchLabel(search)}</p>
        <p className="text-sm text-muted-foreground">
          {automatic ? "Automática" : "Manual"}
          <span className="@4xl:hidden"> · {formatDate(search.createdAt, true)}</span>
        </p>
        {failure ? (
          <p className="mt-0.5 flex items-start gap-1.5 text-sm">
            <TriangleAlertIcon
              aria-hidden
              strokeWidth={2}
              className="mt-0.5 size-4 shrink-0 text-red"
            />
            {failure}
          </p>
        ) : null}
      </div>
      <div className="col-start-2 @4xl:col-start-auto">
        <SearchResult search={search} />
      </div>
      <div className="col-start-2 @4xl:col-start-auto">
        <SearchStatusText search={search} />
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-1 @4xl:col-start-auto @4xl:justify-end">
        <SearchRowActions search={search} quotaSpent={quotaSpent} />
        {isSearchRunning(search.status) ? null : (
          <SearchRowMenu
            search={search}
            quotaSpent={quotaSpent}
            detailsOpen={detailsOpen}
            onToggleDetails={() => setDetailsOpen((open) => !open)}
            onFill={onFill}
          />
        )}
      </div>
      {detailsOpen ? <SearchDetails search={search} /> : null}
    </li>
  );
}
