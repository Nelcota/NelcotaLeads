import type { HistoryLine } from "@/lib/lead-history";

/** The lead's history, newest first: what happened, then who and when. */
export function LeadHistory({ lines }: { lines: HistoryLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="px-1 text-sm font-light text-muted-foreground">
        Nada registrado ainda. Mudanças de etapa, responsável e negócio aparecem aqui.
      </p>
    );
  }
  return (
    <ol className="grouped grid text-sm">
      {lines.map((line) => (
        <li
          key={line.id}
          className="grouped-row flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 [--inset:16px]"
        >
          <span className="font-medium">{line.text}</span>
          <span className="text-xs font-light text-muted-foreground tabular-nums">{line.meta}</span>
        </li>
      ))}
    </ol>
  );
}
