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
import { SoloTeam } from "@/components/team/solo-team";
import { TeamActivity } from "@/components/team/team-activity";
import { TeamError, TeamSkeleton } from "@/components/team/team-states";
import { pageTitle } from "@/lib/page-title";
import { DEFAULT_PERIOD, overviewPeriodSchema, type OverviewPeriod } from "@/lib/period";
import { teamQuery } from "@/lib/queries";
import { idSchema, lenientSearch } from "@/lib/schemas";
import { isSoloTeam } from "@/lib/team";
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

/** Alone on the team: the phone's period selector, then the invite, free leads and your numbers. */
function SoloBody({ team, period, now }: { team: Team; period: OverviewPeriod; now: Date }) {
  const self = team.members.find((member) => member.id === team.me) ?? team.members[0] ?? null;
  if (!self) {
    return (
      <p className="grouped p-6 text-base text-muted-foreground">Nenhuma conta na equipe ainda.</p>
    );
  }
  return (
    <>
      <div className="sm:hidden">
        <PeriodSelectorFor period={period} />
      </div>
      <SoloTeam member={self} team={team} period={period} now={now} />
    </>
  );
}

function TeamBody({ team, period, now }: { team: Team; period: OverviewPeriod; now: Date }) {
  const partner = useOpenPartner();
  const members = orderMembers(team.members, team.me);
  if (isSoloTeam(members)) return <SoloBody team={team} period={period} now={now} />;
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
          stays on the left, as in the approved canvas. Side by side only from xl: below it the
          free leads list got squeezed to ~340px and its names cut to "Pad…". Cards in a row share
          one height (approved canvas, revision 5b). */}
      <div className="grid gap-6 xl:grid-cols-2">
        <FreeLeads free={team.free} members={members} me={team.me} now={now} />
        <div className="min-w-0 xl:order-first [&>section]:h-full">
          <GoalByPartner goal={team.goal} members={members} />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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

/** "Só você por enquanto · 7 leads com você", or "3 sócios · 4 leads sem dono". */
function TeamDescription({ team }: { team: Team }) {
  if (isSoloTeam(team.members)) {
    const held = team.members[0]?.held ?? 0;
    return (
      <>
        Só você por enquanto
        {" · "}
        <Stat value={held}>{held === 1 ? "lead com você" : "leads com você"}</Stat>
        {team.free.total > 0 ? (
          <>
            {" · "}
            <Stat value={team.free.total}>sem dono</Stat>
          </>
        ) : null}
      </>
    );
  }
  return (
    <>
      <Stat value={team.members.length}>sócios</Stat>
      {" · "}
      <Stat value={team.free.total}>
        {team.free.total === 1 ? "lead sem dono" : "leads sem dono"}
      </Stat>
    </>
  );
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
      description={data ? <TeamDescription team={data} /> : null}
    >
      {data ? <TeamBody team={data} period={period} now={new Date(dataUpdatedAt)} /> : null}
      {!data && isError ? <TeamError onRetry={() => void refetch()} /> : null}
      {!data && !isError ? <TeamSkeleton /> : null}
    </Page>
  );
}
