import type { SearchStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

const LABELS: Record<SearchStatus, string> = {
  collecting: "Coletando",
  analyzing: "Analisando",
  done: "Concluída",
  error: "Falhou",
};

export function SearchStatusBadge({
  status,
  errors = 0,
}: {
  status: SearchStatus;
  errors?: number;
}) {
  const running = status === "collecting" || status === "analyzing";
  const withErrors = status === "done" && errors > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        status === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          running && "animate-pulse bg-brand",
          status === "done" && (withErrors ? "bg-warning" : "bg-tier-high"),
          status === "error" && "bg-destructive",
        )}
      />
      {withErrors ? `Concluída · ${errors} com erro` : LABELS[status]}
    </span>
  );
}
