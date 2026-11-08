import { Link } from "@tanstack/react-router";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { StatusLabel } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { nicheSteps } from "@/lib/overview-metrics";
import { LOSS_REASON_LABELS } from "@/lib/schemas";
import type { NicheMetricRow } from "@/server/niches";
import { NicheStep } from "./niche-step";

export type NicheTag = "mostCloses" | "mostRefuses" | null;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function TagLabel({ tag }: { tag: NicheTag }) {
  if (tag === "mostCloses") {
    return (
      <StatusLabel icon={TrendingUpIcon} tone="green">
        mais fecha
      </StatusLabel>
    );
  }
  if (tag === "mostRefuses") {
    return (
      <StatusLabel icon={TrendingDownIcon} tone="red">
        mais recusa
      </StatusLabel>
    );
  }
  return null;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] text-tertiary">{label}</span>
      <span className="truncate font-semibold tabular-nums">{children}</span>
    </div>
  );
}

/** One niche: its tag, funnel, revenue and main loss reason, and "Ver leads". */
export function NicheCard({ niche, tag }: { niche: NicheMetricRow; tag: NicheTag }) {
  const contactedLine = plural(niche.contacted, "contatado", "contatados");
  return (
    <article className="flex min-w-0 flex-col gap-3.5 rounded-2xl bg-card-2 px-[18px] py-4">
      <div className="flex min-h-7 items-center gap-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="truncate text-[17px] font-semibold">{niche.label}</h3>
          <TagLabel tag={tag} />
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link
            to="/leads"
            search={{ view: "all", niche: niche.key }}
            aria-label={`Ver leads de ${niche.label}`}
          >
            Ver leads
          </Link>
        </Button>
      </div>
      <span className="text-sm text-muted-foreground">
        {plural(niche.leads, "lead", "leads")} · {contactedLine}
      </span>
      {niche.contacted > 0 ? (
        <div className="flex flex-col gap-2.5">
          {nicheSteps(niche).map((step) => (
            <NicheStep key={step.label} step={step} />
          ))}
        </div>
      ) : (
        <p className="py-3 text-sm text-muted-foreground">Nenhum lead contatado neste período.</p>
      )}
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
        <Fact label="Receita">
          {niche.revenueCents > 0 ? formatCents(niche.revenueCents) : "—"}
        </Fact>
        <Fact label="Perda principal">
          {niche.topLossReason ? LOSS_REASON_LABELS[niche.topLossReason] : "—"}
        </Fact>
      </div>
    </article>
  );
}
