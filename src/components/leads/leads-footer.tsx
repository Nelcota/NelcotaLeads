import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 25;

const COUNT_FORMAT = new Intl.NumberFormat("pt-BR");

/** The card's footer: how many leads, how many are still being analyzed, and the pages. */
export function LeadsFooter({
  total,
  pending,
  truncatedOf,
  page,
  onPage,
}: {
  /** Rows loaded for this tab. */
  total: number;
  pending: number;
  /** The full count when the list stopped at its limit. */
  truncatedOf: number | null;
  page: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);
  const of = truncatedOf ?? total;

  return (
    <div
      className="flex items-center justify-between gap-4 border-t border-border px-4 py-2 text-[13px] text-tertiary"
      aria-live="polite"
    >
      <span>
        <b className="font-medium text-muted-foreground tabular-nums">{COUNT_FORMAT.format(of)}</b>{" "}
        {of === 1 ? "lead" : "leads"}
        {pending > 0 ? ` · ${pending} em análise` : null}
        {truncatedOf !== null ? ". Refine os filtros para ver todos." : null}
      </span>
      {total > PAGE_SIZE ? (
        <span className="flex items-center gap-1">
          <span className="mr-1 tabular-nums">
            {first}–{last} de {COUNT_FORMAT.format(total)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próxima página"
            disabled={page >= pages - 1}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </span>
      ) : null}
    </div>
  );
}
