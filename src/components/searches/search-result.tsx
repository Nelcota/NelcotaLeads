import type { ReactNode } from "react";
import type { Search } from "@/db/schema";
import { formatCount } from "@/lib/format";
import { analysisPercent } from "@/lib/search-list";
import type { SearchWithState } from "@/lib/search-state";
import { HighScoreLink } from "@/components/searches/high-score-link";
import { searchLabel } from "@/lib/searches";

const COUNT = "font-semibold text-foreground tabular-nums";

function finishedText(search: Search): ReactNode {
  if (search.foundCount === 0 && search.duplicateCount === 0) return "Nenhuma empresa nova";
  const found = <b className={COUNT}>{formatCount(search.foundCount)}</b>;
  if (search.status === "cancelled") {
    return (
      <>
        {found} {search.foundCount === 1 ? "nova" : "novas"} antes de cancelar
      </>
    );
  }
  return (
    <>
      {found} {search.foundCount === 1 ? "nova" : "novas"}
      {search.duplicateCount > 0 ? <> · {formatCount(search.duplicateCount)} já existiam</> : null}
      {search.errorCount > 0 ? <> · {formatCount(search.errorCount)} com erro</> : null}
    </>
  );
}

/**
 * What the search brought, with a native progress bar while it runs: without a value while
 * collecting (how many Google returns is unknown), with the share analyzed afterwards.
 */
export function SearchResult({ search }: { search: SearchWithState }) {
  const name = searchLabel(search);
  if (search.status === "collecting") {
    return (
      <div className="grid gap-1.5 text-sm text-muted-foreground">
        <span>
          <b className={COUNT}>{formatCount(search.foundCount)}</b>{" "}
          {search.foundCount === 1 ? "empresa" : "empresas"} até agora
        </span>
        <progress className="search-progress" aria-label={`Coletando empresas: ${name}`} />
      </div>
    );
  }
  if (search.status === "analyzing") {
    return (
      <div className="grid gap-1.5 text-sm text-muted-foreground">
        <span>
          <b className={COUNT}>{formatCount(search.analyzedCount + search.errorCount)}</b> de{" "}
          {formatCount(search.foundCount)} analisadas
        </span>
        <progress
          className="search-progress"
          max={100}
          value={analysisPercent(search)}
          aria-label={`Análise: ${name}`}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-0.5 text-sm text-muted-foreground">
      <p>{finishedText(search)}</p>
      {search.highScoreCount > 0 ? (
        <HighScoreLink searchId={search.id} count={search.highScoreCount} />
      ) : null}
    </div>
  );
}
