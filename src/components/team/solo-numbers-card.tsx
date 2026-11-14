import { Avatar } from "@/components/apple-ui";
import { formatCents } from "@/lib/money";
import { PERIOD_CAPTIONS, type OverviewPeriod } from "@/lib/period";
import { dealsWord, todayLines } from "@/lib/team-member";
import type { TeamMember } from "@/server/team";
import { PartnerTiles } from "./partner-tiles";
import { PartnerToday } from "./partner-today";

/** Alone on the team: your deals in the period, the four pipeline numbers and today. */
export function SoloNumbersCard({
  member,
  period,
  today,
}: {
  member: TeamMember;
  period: OverviewPeriod;
  today: string;
}) {
  return (
    <section
      className="grouped enter p-5 sm:p-6"
      style={{ animationDelay: "60ms" }}
      aria-label={`Números de ${member.name}`}
    >
      <div className="flex items-center gap-3 border-b border-border/60 pb-3.5">
        <Avatar neutral name={member.name} src={member.avatar} size={44} />
        <span className="min-w-0 flex-1 truncate text-lg font-semibold">
          {member.name}
          <span className="font-normal text-muted-foreground"> · você</span>
        </span>
      </div>
      <p className="mt-4 mb-1 flex flex-wrap items-baseline gap-2">
        <strong className="text-[32px] leading-none font-semibold tabular-nums">
          {member.won.deals}
        </strong>
        <span className="text-muted-foreground">
          {dealsWord(member.won.deals)} · {formatCents(member.won.revenueCents)}
        </span>
        <span className="ml-auto text-sm text-tertiary">{PERIOD_CAPTIONS[period]}</span>
      </p>
      <div className="pt-3">
        <PartnerTiles member={member} pipelineOnly />
      </div>
      <PartnerToday lines={todayLines(member, today, true)} />
      <p className="pt-4 text-sm text-muted-foreground">
        O resto da página aparece quando o segundo sócio entrar.
      </p>
    </section>
  );
}
