import type { SearchStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<SearchStatus, string> = {
  collecting: "Coletando",
  analyzing: "Analisando",
  done: "Concluída",
  error: "Com erro",
};

export function SearchStatusBadge({
  status,
  errors = 0,
}: {
  status: SearchStatus;
  errors?: number;
}) {
  if (status === "done" && errors > 0) return <Badge variant="outline">Concluída com erros</Badge>;
  return (
    <Badge
      variant={status === "error" ? "destructive" : status === "done" ? "secondary" : "outline"}
    >
      {status === "collecting" || status === "analyzing" ? (
        <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-brand" />
      ) : null}
      {LABELS[status]}
    </Badge>
  );
}
