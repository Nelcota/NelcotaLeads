import type { OverviewPeriod } from "@/lib/period";
import type { Team, TeamMember } from "@/server/team";
import { FreeLeads } from "./free-leads";
import { SoloInviteCard } from "./solo-invite-card";
import { SoloNumbersCard } from "./solo-numbers-card";

/**
 * The Equipe page for a team of one (approved canvas, 2026-11-12, revision 5c): the invite and
 * the free leads ("Pegar" only) on the left, your numbers and today on the right. The goal per
 * partner, splitting and the activity wait for a second partner.
 */
export function SoloTeam({
  member,
  team,
  period,
  now,
}: {
  member: TeamMember;
  team: Team;
  period: OverviewPeriod;
  now: Date;
}) {
  const hasFree = team.free.total > 0 || team.free.newCount > 0;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid min-w-0 gap-6">
        <SoloInviteCard
          member={member}
          invites={team.invites}
          emailsEnabled={team.inviteEmailsEnabled}
          today={team.today}
        />
        {hasFree ? (
          <FreeLeads free={team.free} members={[member]} me={member.id} now={now} />
        ) : null}
      </div>
      <SoloNumbersCard member={member} period={period} today={team.today} />
    </div>
  );
}
