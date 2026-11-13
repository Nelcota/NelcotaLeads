import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, ClockIcon, RotateCwIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Search } from "@/db/schema";
import { useDelayedCancel } from "@/hooks/use-delayed-cancel";
import { useRepeatSearch } from "@/hooks/use-search-actions";
import { formatCount } from "@/lib/format";
import { isSearchRunning } from "@/lib/search-list";

function leadsLabel(count: number): string {
  return count === 1 ? "Ver 1 lead" : `Ver ${formatCount(count)} leads`;
}

/**
 * The actions in view on a search row: cancel while it runs (undoable for a few seconds); after
 * a failure, try again (or "Volta amanhã" once today's quota is spent); search again on a
 * visible finished search; and the link to its leads whenever it found any, hidden or not.
 */
export function SearchRowActions({ search, quotaSpent }: { search: Search; quotaSpent: boolean }) {
  const running = isSearchRunning(search.status);
  const cancel = useDelayedCancel(search.id, running);
  const repeat = useRepeatSearch();
  const hidden = search.hiddenAt !== null;

  if (running && cancel.waiting) {
    return (
      <Button variant="outline" size="sm" onClick={cancel.undo}>
        <Undo2Icon />
        Desfazer
      </Button>
    );
  }

  if (running) {
    // Red outline chosen in the mockup review (2026-11-12) so stopping a search stands out.
    return (
      <Button
        variant="destructive"
        size="sm"
        className="border-red/55 hover:border-red hover:bg-transparent"
        disabled={cancel.stopping}
        onClick={cancel.request}
      >
        {cancel.stopping ? "Cancelando…" : "Cancelar"}
      </Button>
    );
  }

  const failed = search.status === "error";
  const retry = failed && !hidden && !quotaSpent;
  const waitTomorrow = failed && !hidden && quotaSpent;
  const again = !failed && !hidden && !quotaSpent && search.foundCount > 0;
  const repeatLabel = retry ? "Tentar de novo" : "Buscar de novo";
  return (
    <>
      {waitTomorrow ? (
        <Button variant="outline" size="sm" disabled title="O limite de hoje acabou">
          <ClockIcon />
          Volta amanhã
        </Button>
      ) : null}
      {retry || again ? (
        <Button
          variant={retry ? "outline" : "ghost"}
          size="sm"
          disabled={repeat.isPending}
          onClick={() => repeat.mutate(search.id)}
        >
          <RotateCwIcon />
          {repeat.isPending ? "Buscando…" : repeatLabel}
        </Button>
      ) : null}
      {search.foundCount > 0 ? (
        <Button asChild variant="outline" size="sm">
          <Link to="/leads" search={{ view: "all", searchId: search.id }}>
            {leadsLabel(search.foundCount)}
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : null}
    </>
  );
}
