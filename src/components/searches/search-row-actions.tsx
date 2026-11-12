import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, ClockIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Search } from "@/db/schema";
import { useCancelSearch, useRepeatSearch } from "@/hooks/use-search-actions";
import { formatCount } from "@/lib/format";
import { isSearchRunning } from "@/lib/search-list";

function leadsLabel(count: number): string {
  return count === 1 ? "Ver 1 lead" : `Ver ${formatCount(count)} leads`;
}

/**
 * The actions a search shows in its row: cancel while it runs; try again after a failure (or
 * "Volta amanhã" once today's quota is spent); search again and open its leads when it found any.
 */
export function SearchRowActions({ search, quotaSpent }: { search: Search; quotaSpent: boolean }) {
  const cancel = useCancelSearch();
  const repeat = useRepeatSearch();
  const hidden = search.hiddenAt !== null;

  if (isSearchRunning(search.status)) {
    // Red outline chosen in the mockup review (2026-11-12) so stopping a search stands out.
    return (
      <Button
        variant="destructive"
        size="sm"
        className="border-red/55 hover:border-red hover:bg-transparent"
        disabled={cancel.isPending}
        onClick={() => cancel.mutate(search.id)}
      >
        {cancel.isPending ? "Cancelando…" : "Cancelar"}
      </Button>
    );
  }
  if (hidden) return null;
  if (search.status === "error") {
    if (quotaSpent) {
      return (
        <Button
          variant="outline"
          size="sm"
          aria-disabled
          title="O limite de hoje acabou"
          className="opacity-60"
        >
          <ClockIcon />
          Volta amanhã
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={repeat.isPending}
        onClick={() => repeat.mutate(search.id)}
      >
        <RotateCwIcon />
        {repeat.isPending ? "Buscando…" : "Tentar de novo"}
      </Button>
    );
  }
  if (search.foundCount === 0) return null;
  return (
    <>
      {quotaSpent ? null : (
        <Button
          variant="ghost"
          size="sm"
          disabled={repeat.isPending}
          onClick={() => repeat.mutate(search.id)}
        >
          <RotateCwIcon />
          {repeat.isPending ? "Buscando…" : "Buscar de novo"}
        </Button>
      )}
      <Button asChild variant="outline" size="sm">
        <Link to="/leads" search={{ view: "all", searchId: search.id }}>
          {leadsLabel(search.foundCount)}
          <ArrowRightIcon />
        </Link>
      </Button>
    </>
  );
}
