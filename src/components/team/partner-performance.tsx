import { PERIOD_CAPTIONS, type OverviewPeriod } from "@/lib/period";
import type { TeamMember } from "@/server/team";
import { PartnerColumn } from "./partner-column";
import { PartnerRow } from "./partner-row";

/**
 * "Desempenho por sócio": on a wide screen one column per partner (deals of the period, then
 * "Hoje"); on a phone one compact row each, so the free leads below stay close.
 */
export function PartnerPerformance({
  members,
  me,
  period,
  today,
  onOpen,
}: {
  members: TeamMember[];
  me: string | null;
  period: OverviewPeriod;
  today: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section
      className="grouped enter @container/team-performance p-5 sm:p-6"
      aria-labelledby="team-performance"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <h2 id="team-performance" className="text-[20px] font-semibold tracking-[-0.015em]">
          Desempenho por sócio
        </h2>
        <span className="ml-auto text-sm text-tertiary">{PERIOD_CAPTIONS[period]}</span>
      </div>
      <div className="pt-1 lg:hidden">
        {members.map((member) => (
          <PartnerRow
            key={member.id}
            member={member}
            isMe={member.id === me}
            onOpen={() => onOpen(member.id)}
          />
        ))}
      </div>
      {/* Equal columns, 3 per row at most: a 4th partner starts a new row (.partner-grid). */}
      <div className="partner-grid pt-4 max-lg:hidden">
        {members.map((member) => (
          <div key={member.id}>
            <PartnerColumn
              member={member}
              isMe={member.id === me}
              period={period}
              today={today}
              onOpen={() => onOpen(member.id)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
