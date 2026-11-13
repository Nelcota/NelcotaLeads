import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import { StageLabel } from "@/components/leads/stage-label";
import { Skeleton } from "@/components/ui/skeleton";
import { leadStage, nextStep } from "@/lib/lead-row";
import { usePartnerLeads } from "@/hooks/use-partner-leads";
import { teamLinks } from "@/lib/team-links";

/** "Em andamento": the partner's contacted and replied leads, the most urgent first. */
export function PartnerLeads({
  memberId,
  held,
  today,
}: {
  memberId: string;
  held: number;
  today: string;
}) {
  const { rows, failed, now } = usePartnerLeads(memberId);
  if (failed) return <p className="text-base text-red">Não foi possível carregar os leads.</p>;
  if (!rows) return <Skeleton className="h-40 rounded-[14px]" />;
  return (
    <div>
      {rows.length === 0 ? (
        <p className="flex min-h-11 items-center text-base text-muted-foreground">
          Nenhum lead em andamento.
        </p>
      ) : (
        rows.map((lead) => {
          // The most urgent step: follow-up day, then the meeting or the last reply, then the send.
          const step = nextStep(lead, today, now);
          return (
            <Link
              key={lead.id}
              {...teamLinks.lead(lead.id)}
              className="group -mx-2 flex min-h-15 items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-fill-2 focus-visible:bg-fill-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{lead.name}</span>
                <span className="flex flex-wrap items-center gap-x-2.5 text-sm text-muted-foreground">
                  <StageLabel
                    stage={leadStage(lead)}
                    className="font-normal text-muted-foreground"
                  />
                  {step ? (
                    <span style={step.color ? { color: step.color } : undefined}>{step.text}</span>
                  ) : null}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden
                className="size-4 shrink-0 text-tertiary transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          );
        })
      )}
      <Link
        {...teamLinks.held(memberId)}
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-base font-semibold text-blue hover:underline"
      >
        Ver os {held} leads
        <ArrowRightIcon aria-hidden className="size-4" />
      </Link>
    </div>
  );
}
