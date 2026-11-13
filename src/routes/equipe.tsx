import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Page, Stat } from "@/components/app-shell";
import { PeriodSelector } from "@/components/overview/period-selector";
import { FreeLeads } from "@/components/team/free-leads";
import { GoalByPartner } from "@/components/team/goal-by-partner";
import { InvitesCard } from "@/components/team/invites-card";
import { PartnerPerformance } from "@/components/team/partner-performance";
import { PartnerSheet } from "@/components/team/partner-sheet";
import { TeamActivity } from "@/components/team/team-activity";
import { TeamError, TeamSkeleton } from "@/components/team/team-states";
import { pageTitle } from "@/lib/page-title";
import { DEFAULT_PERIOD, overviewPeriodSchema, type OverviewPeriod } from "@/lib/period";
import { teamQuery } from "@/lib/queries";
import { idSchema, lenientSearch } from "@/lib/schemas";
import { activityLine } from "@/lib/team-activity";
import { orderMembers } from "@/lib/team-member";
import type { Team } from "@/server/team";

/** The Equipe page opens on 30 days, like the Visão geral (decided 2026-11-09). */
const TEAM_DEFAULT_PERIOD: OverviewPeriod = DEFAULT_PERIOD;

export const Route = createFileRoute("/equipe")({
  head: () => ({ meta: [{ title: pageTitle("Equipe") }] }),
  validateSearch: lenientSearch(
    z.object({
      period: overviewPeriodSchema.optional(),
      // The open profile (a user id), so it can be shared and Back closes it.
      socio: idSchema.optional(),
    }),
  ),
  loaderDeps: ({ search }) => ({ period: search.period ?? TEAM_DEFAULT_PERIOD }),
  loader: ({ context, deps }) => context.queryClient.prefetchQuery(teamQuery(deps.period)),
  component: TeamPage,
});

/** "7 dias / 30 dias / Este mês", kept in the URL (`?period=`). */
function usePeriod() {
  const period = Route.useSearch().period ?? TEAM_DEFAULT_PERIOD;
  const navigate = useNavigate({ from: Route.fullPath });
  const setPeriod = (next: OverviewPeriod) =>
    void navigate({ search: (current) => ({ ...current, period: next }), replace: true });
  return { period, setPeriod };
}

/** The open profile, kept in the URL (`?socio=`): opening pushes, so Back closes it. */
function useOpenPartner() {
  const openId = Route.useSearch().socio ?? null;
  const navigate = useNavigate({ from: Route.fullPath });
  const open = (id: string) => void navigate({ search: (current) => ({ ...current, socio: id }) });
  const close = () =>
    void navigate({ search: (current) => ({ ...current, socio: undefined }), replace: true });
  return { openId, open, close };
}

function TeamBody({ team, period, now }: { team: Team; period: OverviewPeriod; now: Date }) {
  const partner = useOpenPartner();
  const members = orderMembers(team.members, team.me);
  const names = new Map(members.map((member) => [member.id, member.name]));
  const activity = team.activity.map((event) => activityLine(event, names, team.me, now));
  const open = members.find((member) => member.id === partner.openId) ?? null;
  return (
    <>
      <div className="sm:hidden">
        <PeriodSelectorFor period={period} />
      </div>
      <PartnerPerformance
        members={members}
        me={team.me}
        period={period}
        today={team.today}
        onOpen={partner.open}
      />
      {/* On a phone the free leads come first (something to act on); side by side the goal
          stays on the left, as in the approved canvas. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <FreeLeads free={team.free} members={members} me={team.me} today={team.today} />
        <div className="min-w-0 lg:order-first">
          <GoalByPartner goal={team.goal} members={members} />
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TeamActivity lines={activity} members={members} period={period} />
        <InvitesCard
          invites={team.invites}
          emailsEnabled={team.inviteEmailsEnabled}
          today={team.today}
        />
      </div>
      <PartnerSheet
        member={open}
        isMe={open?.id === team.me}
        team={team}
        activity={activity}
        period={period}
        onClose={partner.close}
      />
    </>
  );
}

function PeriodSelectorFor({ period }: { period: OverviewPeriod }) {
  const { setPeriod } = usePeriod();
  return <PeriodSelector value={period} onChange={setPeriod} />;
}

function TeamPage() {
  const { period, setPeriod } = usePeriod();
  const { data, isError, refetch, dataUpdatedAt } = useQuery(teamQuery(period));
  return (
    <Page
      title="Equipe"
      actions={
        <div className="max-sm:hidden">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      }
      description={
        data ? (
          <>
            <Stat value={data.members.length}>
              {data.members.length === 1 ? "sócio" : "sócios"}
            </Stat>
            {" · "}
            <Stat value={data.free.total}>
              {data.free.total === 1 ? "lead sem dono" : "leads sem dono"}
            </Stat>
          </>
        ) : null
      }
    >
      {data ? <TeamBody team={data} period={period} now={new Date(dataUpdatedAt)} /> : null}
      {!data && isError ? <TeamError onRetry={() => void refetch()} /> : null}
      {!data && !isError ? <TeamSkeleton /> : null}
    </Page>
  );
}
