import type { Search } from "@/db/schema";
import { formatCount } from "@/lib/format";
import { analysisPercent } from "@/lib/search-list";

function Count({ value }: { value: number }) {
  return <b className="font-semibold text-foreground tabular-nums">{formatCount(value)}</b>;
}

function finishedText(search: Search) {
  if (search.foundCount === 0) {
    return <span>Nenhuma empresa nova</span>;
  }
  if (search.status === "cancelled") {
    return (
      <span>
        <Count value={search.foundCount} /> novas antes de cancelar
      </span>
    );
  }
  return (
    <span>
      <Count value={search.foundCount} /> novas
      {search.duplicateCount > 0 ? <> · {formatCount(search.duplicateCount)} já existiam</> : null}
      {search.errorCount > 0 ? <> · {formatCount(search.errorCount)} com erro</> : null}
    </span>
  );
}

/**
 * What the search brought, with a native progress bar while it runs: without a value while
 * collecting (how many Google returns is unknown), with the share analyzed afterwards.
 */
export function SearchResult({ search }: { search: Search }) {
  if (search.status === "collecting") {
    return (
      <div className="grid gap-1.5 text-sm text-muted-foreground">
        <span>
          <Count value={search.foundCount} /> empresas até agora
        </span>
        <progress className="search-progress" aria-label="Coletando empresas" />
      </div>
    );
  }
  if (search.status === "analyzing") {
    return (
      <div className="grid gap-1.5 text-sm text-muted-foreground">
        <span>
          <Count value={search.analyzedCount + search.errorCount} /> de{" "}
          {formatCount(search.foundCount)} analisadas
        </span>
        <progress
          className="search-progress"
          max={100}
          value={analysisPercent(search)}
          aria-label="Progresso da análise"
        />
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">{finishedText(search)}</p>;
}
