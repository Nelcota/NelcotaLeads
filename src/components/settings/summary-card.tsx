import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "@/components/icons";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SettingsTab } from "@/lib/settings-tabs";
import { cn } from "@/lib/utils";
import { SETTINGS_HAIRLINE, SETTINGS_SURFACE } from "./surface";

/**
 * One area on the Resumo tab: its name, one sentence, a live miniature of its state and the way
 * into its tab. The whole card is the link; hovering one dims the others (the row's `group`).
 */
export function SummaryCard({
  tab,
  title,
  description,
  cta,
  children,
}: {
  tab: SettingsTab;
  title: string;
  description: string;
  cta: string;
  /** The miniature; `null` while its data loads. */
  children: ReactNode | null;
}) {
  return (
    <Link
      to="/settings"
      search={{ aba: tab }}
      className={cn(
        SETTINGS_SURFACE,
        "flex min-h-[248px] flex-col gap-4 p-5 text-foreground transition-[opacity,border-color] duration-150 group-hover/cards:not-hover:opacity-60 hover:border-border focus-visible:border-border motion-reduce:transition-none dark:hover:border-border",
      )}
    >
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid">
        {children ?? (
          <div role="status" aria-label={`Carregando ${title}`} className="grid gap-2 pt-1">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        )}
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-blue">
        {cta}
        <ChevronRightIcon aria-hidden className="size-4" />
      </span>
    </Link>
  );
}

/** One line of a card's miniature: a label and its value on the right. */
export function SummaryLine({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center justify-between gap-3 border-t first:border-t-0",
        SETTINGS_HAIRLINE,
      )}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 text-right text-muted-foreground tabular-nums">{value}</span>
    </div>
  );
}

/** A thin bar for "12 de 30": decorative, the numbers sit in the line above it. */
export function SummaryBar({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div aria-hidden className="mb-1 h-1.5 overflow-hidden rounded-full bg-fill">
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}
