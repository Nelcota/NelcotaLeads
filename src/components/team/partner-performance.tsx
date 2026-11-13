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
    <section className="grouped enter p-5 sm:p-6" aria-labelledby="team-performance">
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
      {/* Equal columns: the gap is fixed and the hairline sits in its middle, so every partner
          gets the same width (padding only on the inner sides made the middle one narrower). */}
      <div className="grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-x-10 pt-4 max-lg:hidden lg:grid">
        {members.map((member) => (
          <div
            key={member.id}
            className="relative min-w-0 [&+&]:before:absolute [&+&]:before:inset-y-0 [&+&]:before:-left-5 [&+&]:before:border-l [&+&]:before:border-border/60 [&+&]:before:content-['']"
          >
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
