import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/apple-ui";
import { ProgressBar } from "@/components/overview/progress-bar";
import { monthName } from "@/lib/goal";
import { formatCents } from "@/lib/money";
import { dealsWord } from "@/lib/team-member";
import type { Team, TeamMember } from "@/server/team";

function PartnerShare({ member, goalCents }: { member: TeamMember; goalCents: number }) {
  const share = goalCents > 0 ? member.month.revenueCents / goalCents : 0;
  const percent = Math.round(share * 100);
  return (
    <div className="grid min-h-15 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-border/60 py-2 last:border-b-0">
      <Avatar neutral name={member.name} src={member.avatar} size={28} />
      <span className="truncate font-semibold">{member.name}</span>
      <span className="text-right text-sm text-muted-foreground tabular-nums">
        {member.month.deals} {dealsWord(member.month.deals)} ·{" "}
        {formatCents(member.month.revenueCents)}{" "}
        <span className="ml-1text-base font-semibold text-foreground">{percent}%</span>
      </span>
      <div className="col-span-2 col-start-2">
        <ProgressBar share={share} label={`${member.name}: ${percent}% da meta de receita`} />
      </div>
    </div>
  );
}

/**
 * "Meta do mês" by partner: each one's share of the revenue goal. The team's own bars live on
 * the Visão geral, linked from the header, so they are not repeated here.
 */
export function GoalByPartner({ goal, members }: { goal: Team["goal"]; members: TeamMember[] }) {
  const target = goal.goal;
  return (
    <section
      className="grouped enter p-5 sm:p-6"
      style={{ animationDelay: "60ms" }}
      aria-labelledby="team-goal"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <h2 id="team-goal" className="text-[20px] font-semibold tracking-[-0.015em]">
          Meta do mês
        </h2>
        <span className="text-sm text-tertiary">{monthName(goal.month)}</span>
        <Link
          to="/"
          className="ml-auto inline-flex min-h-11 items-center rounded-lg px-1 text-base font-semibold text-blue hover:underline"
        >
          {target ? "Meta do time na Visão geral" : "Definir na Visão geral"}
        </Link>
      </div>
      {target ? (
        <div className="pt-3">
          <p className="pb-1 text-sm font-semibold text-tertiary">% da meta por sócio · receita</p>
          {members.map((member) => (
            <PartnerShare key={member.id} member={member} goalCents={target.revenueCents} />
          ))}
        </div>
      ) : (
        <p className="pt-4 text-base text-muted-foreground">
          Sem meta para este mês. A parte de cada sócio aparece quando houver uma.
        </p>
      )}
    </section>
  );
}
