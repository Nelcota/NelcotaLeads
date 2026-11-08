import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SendIcon } from "lucide-react";
import { z } from "zod";
import { Page, Stat } from "@/components/app-shell";
import { AiVsHandCard } from "@/components/overview/ai-vs-hand-card";
import { FunnelCard } from "@/components/overview/funnel-card";
import { LossReasonsCard } from "@/components/overview/loss-reasons-card";
import { MetricBlocks } from "@/components/overview/metric-blocks";
import { MonthlyGoalCard } from "@/components/overview/monthly-goal-card";
import { NeedsYou } from "@/components/overview/needs-you";
import { NichesTable } from "@/components/overview/niches-table";
import { OverviewAlerts } from "@/components/overview/overview-alerts";
import { PeriodSelector } from "@/components/overview/period-selector";
import { ReplyHoursCard } from "@/components/overview/reply-hours-card";
import { TodaysAgenda } from "@/components/overview/todays-agenda";
import { TodaysDispatch } from "@/components/overview/todays-dispatch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { metricBlocks } from "@/lib/metric-blocks";
import { buildAlerts } from "@/lib/overview";
import { pageTitle } from "@/lib/page-title";
import {
  overviewPeriodSchema,
  PERIOD_CAPTIONS,
  readPeriod,
  type OverviewPeriod,
} from "@/lib/period";
import {
  dashboardQuery,
  leadCountsQuery,
  monthlyGoalQuery,
  overviewMetricsQuery,
} from "@/lib/queries";
import { lenientSearch } from "@/lib/schemas";
import type { Dashboard } from "@/server/dashboard";

const searchSchema = lenientSearch(z.object({ period: overviewPeriodSchema.optional() }));

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: pageTitle("Visão geral") }] }),
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ period: readPeriod(search.period) }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(dashboardQuery),
      context.queryClient.prefetchQuery(overviewMetricsQuery(deps.period)),
      context.queryClient.prefetchQuery(monthlyGoalQuery),
    ]),
  component: OverviewPage,
});

function DispatchButton() {
  return (
    <Button asChild>
      <Link to="/leads" search={{ view: "todo" }}>
        <SendIcon />
        <span className="sm:hidden">Disparar</span>
        <span className="max-sm:hidden">Selecionar e disparar</span>
      </Link>
    </Button>
  );
}

function OverviewSkeleton() {
  return (
    <Page title="Visão geral" actions={<DispatchButton />}>
      <Skeleton className="h-40 rounded-[20px]" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-44 rounded-[20px]" />
        ))}
      </div>
    </Page>
  );
}

/** "7 dias / 30 dias / Este mês", kept in the URL (`?period=`). */
function usePeriod() {
  const period = readPeriod(Route.useSearch().period);
  const navigate = useNavigate({ from: Route.fullPath });
  const setPeriod = (next: OverviewPeriod) =>
    void navigate({ search: (current) => ({ ...current, period: next }), replace: true });
  return { period, setPeriod };
}

/** The period's blocks, funnel, niches, losses and AI × escrito à mão; skeletons while loading. */
function PeriodMetrics({
  data,
  period,
  onPeriodChange,
}: {
  data: Dashboard;
  period: OverviewPeriod;
  onPeriodChange: (period: OverviewPeriod) => void;
}) {
  const { data: metrics } = useQuery(overviewMetricsQuery(period));
  const caption = PERIOD_CAPTIONS[period];
  if (!metrics) return <Skeleton className="h-56 rounded-[20px]" />;
  return (
    <>
      {/* On a phone the header has no room for it; it sits above the metrics instead. */}
      <div className="sm:hidden">
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>
      <MetricBlocks blocks={metricBlocks(data, metrics)} caption={caption} />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <FunnelCard
          funnel={metrics.funnel}
          won={metrics.business.won}
          readyToSend={data.stats.readyToSend}
          caption={caption}
        />
        <ReplyHoursCard data={data} />
      </div>
      <NichesTable period={period} caption={caption} />
      <div className="grid gap-3 lg:grid-cols-2">
        <LossReasonsCard losses={metrics.losses} caption={caption} />
        <AiVsHandCard metrics={metrics} caption={caption} />
      </div>
    </>
  );
}

function OverviewPage() {
  const { data } = useQuery(dashboardQuery);
  const { data: counts } = useQuery(leadCountsQuery({}));
  const { period, setPeriod } = usePeriod();
  if (!data) return <OverviewSkeleton />;

  const empty = data.stats.leads === 0;
  const alerts = buildAlerts(data, counts?.byView.followup ?? 0);
  return (
    <Page
      title="Visão geral"
      actions={
        <>
          {empty ? null : (
            <div className="max-sm:hidden">
              <PeriodSelector value={period} onChange={setPeriod} />
            </div>
          )}
          <DispatchButton />
        </>
      }
      description={
        empty ? null : (
          <>
            <Stat value={data.stats.leads}>leads na base</Stat>
            {" · "}
            <Stat value={data.stats.readyToSend}>prontos para disparo</Stat>
            {data.stats.interested > 0 ? (
              <>
                {" · "}
                <Stat value={data.stats.interested} tone="orange">
                  precisam de você
                </Stat>
              </>
            ) : null}
          </>
        )
      }
    >
      <OverviewAlerts alerts={alerts} />
      <NeedsYou data={data} now={data.now} />
      {/* The goal first, then today's agenda, each as tall as its content; alone, a card spans both columns. */}
      <div className="grid items-start gap-3 lg:grid-cols-2 [&>*:only-child]:lg:col-span-2">
        <MonthlyGoalCard />
        <TodaysAgenda />
      </div>
      <TodaysDispatch data={data} />
      {empty ? null : <PeriodMetrics data={data} period={period} onPeriodChange={setPeriod} />}
    </Page>
  );
}
