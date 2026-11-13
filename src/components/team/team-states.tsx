import { CircleAlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** While the Equipe page loads: the shape of its cards. */
export function TeamSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-6">
      <Skeleton className="h-[460px] rounded-[20px]" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-[20px]" />
        <Skeleton className="h-72 rounded-[20px]" />
      </div>
    </div>
  );
}

/** The page could not load; "Tentar de novo" asks again. */
export function TeamError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="grouped flex flex-wrap items-center gap-3.5 p-6">
      <CircleAlertIcon aria-hidden className="size-[22px] shrink-0 text-red" />
      <div className="min-w-64 flex-1">
        <p className="text-lg font-semibold">Não foi possível carregar a equipe.</p>
        <p className="text-base text-muted-foreground">Confira a conexão e tente de novo.</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
