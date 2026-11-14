import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A card's title bar while it loads: the title on the left, a caption or button on the right. */
function CardHead({ titleWidth, asideSize }: { titleWidth: string; asideSize: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
      <Skeleton className={cn("h-6 rounded-lg", titleWidth)} />
      <Skeleton className={cn("rounded-full", asideSize)} />
    </div>
  );
}

function SkeletonCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("grouped grid content-start gap-3 p-5 sm:p-6", className)}>{children}</div>
  );
}

/** One partner's column: name, the big number, the comparison and the "Hoje" lines. */
function PartnerColumnSkeleton() {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <Skeleton className="h-5 flex-1 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-3/5 rounded-lg" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
      <Skeleton className="mt-2 h-4 w-1/4 rounded-md" />
      <Skeleton className="h-5 rounded-lg" />
      <Skeleton className="h-5 rounded-lg" />
    </div>
  );
}

/** A list row: a circle and two lines (a free lead, an activity, a goal share). */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-1.5">
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <Skeleton className="h-3.5 w-1/3 rounded-md" />
      </div>
    </div>
  );
}

/**
 * While the Equipe page loads: the same cards in the same order and grid as the page
 * (Desempenho; Meta do mês and Leads sem dono; Atividade and Convites), so nothing jumps when
 * the data arrives (approved canvas, 2026-11-12).
 */
export function TeamSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando a equipe" className="grid gap-6">
      <SkeletonCard>
        <CardHead titleWidth="w-52" asideSize="h-4 w-28" />
        <div className="grid gap-3 pt-1 lg:hidden">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
        <div className="grid grid-cols-3 gap-10 pt-2 max-lg:hidden">
          <PartnerColumnSkeleton />
          <PartnerColumnSkeleton />
          <PartnerColumnSkeleton />
        </div>
      </SkeletonCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonCard className="xl:order-last">
          <CardHead titleWidth="w-40" asideSize="h-8 w-44" />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </SkeletonCard>
        <SkeletonCard>
          <CardHead titleWidth="w-36" asideSize="h-4 w-24" />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </SkeletonCard>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SkeletonCard>
          <CardHead titleWidth="w-48" asideSize="h-4 w-28" />
          <Skeleton className="h-10 w-3/5 rounded-full" />
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </SkeletonCard>
        <SkeletonCard>
          <CardHead titleWidth="w-28" asideSize="h-4 w-20" />
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-4 w-2/5 rounded-md" />
        </SkeletonCard>
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
      <Button variant="outline" onClick={onRetry} className="pointer-coarse:h-11">
        Tentar de novo
      </Button>
    </div>
  );
}
