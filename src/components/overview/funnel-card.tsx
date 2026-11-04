import { Link } from "@tanstack/react-router";
import { sharePercent } from "@/lib/format";
import type { LeadFilters } from "@/lib/schemas";
import type { PeriodFunnel } from "@/server/metrics-store";

type FunnelStep = {
  label: string;
  value: number;
  /** False when the step is not a part of the one before (no "% of" then). */
  share?: boolean;
  /** Where the step opens: Leads with the matching filter, or Conversas. */
  link:
    | { to: "/leads"; search: LeadFilters }
    | { to: "/conversas"; search: { filter: "needsYou" } };
};

function funnelSteps(funnel: PeriodFunnel, won: number): FunnelStep[] {
  return [
    { label: "Encontrados", value: funnel.found, link: { to: "/leads", search: { view: "all" } } },
    {
      label: "Com e-mail",
      value: funnel.withEmail,
      link: { to: "/leads", search: { view: "all", hasEmail: true } },
    },
    // The leads first e-mailed in the period: not a part of the ones found in it.
    {
      label: "Contatados",
      value: funnel.contacted,
      share: false,
      link: { to: "/leads", search: { view: "waiting" } },
    },
    {
      label: "Responderam",
      value: funnel.replied,
      link: { to: "/leads", search: { view: "talking" } },
    },
    {
      label: "Interessados",
      value: funnel.interested,
      link: { to: "/conversas", search: { filter: "needsYou" } },
    },
    // Closed in the period on any channel (WhatsApp too) and no longer waiting for you: not a
    // part of "Interessados", so a share of it could read 300%.
    {
      label: "Fechados",
      value: won,
      share: false,
      link: { to: "/leads", search: { view: "closed" } },
    },
  ];
}

type FunnelCardProps = {
  funnel: PeriodFunnel;
  won: number;
  readyToSend: number;
  caption: string;
};

/** From the leads found in the period down to closed deals; each step opens the matching leads. */
export function FunnelCard({ funnel, won, readyToSend, caption }: FunnelCardProps) {
  const steps = funnelSteps(funnel, won);
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <section aria-labelledby="funnel" className="grouped enter min-w-0 py-4">
      <div className="flex flex-wrap items-baseline gap-2 px-5 pb-2">
        <h2 id="funnel" className="text-[17px] font-semibold">
          Funil
        </h2>
        <span className="text-sm text-muted-foreground">
          {caption} ·{" "}
          {readyToSend > 0
            ? `${readyToSend} ${readyToSend === 1 ? "lead pronto" : "leads prontos"} para disparo`
            : "nenhum lead novo esperando disparo"}
        </span>
      </div>
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1]?.value : undefined;
        const percent =
          step.share !== false && previous !== undefined && previous > 0
            ? sharePercent(step.value, previous)
            : null;
        return (
          <Link
            key={step.label}
            {...step.link}
            aria-label={`${step.label}: ${step.value}`}
            className="grid grid-cols-[104px_minmax(0,1fr)_72px] items-center gap-3 px-5 py-2 transition-colors outline-none hover:bg-fill-3 focus-visible:bg-fill-2 sm:grid-cols-[130px_minmax(0,1fr)_80px]"
          >
            <span className="truncate text-muted-foreground">{step.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-fill-2">
              <span
                className="bar-grow block h-full min-w-2 rounded-full bg-primary"
                style={{
                  width: `${Math.max(1.5, (step.value / max) * 100)}%`,
                  animationDelay: `${index * 60}ms`,
                }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums">
              {step.value}
              {percent !== null ? (
                <span className="ml-1 text-[12px] font-normal text-tertiary">{percent}%</span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
