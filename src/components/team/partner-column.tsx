import { Link } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, MinusIcon } from "lucide-react";
import { Avatar } from "@/components/apple-ui";
import { formatCents } from "@/lib/money";
import type { OverviewPeriod } from "@/lib/period";
import { teamLinks } from "@/lib/team-links";
import { dealsDelta, dealsWord, todayLines, type DeltaTone } from "@/lib/team-member";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/server/team";
import { PartnerToday } from "./partner-today";

const DELTA = {
  up: { Icon: ArrowUpIcon, tone: "text-green" },
  down: { Icon: ArrowDownIcon, tone: "text-red" },
  flat: { Icon: MinusIcon, tone: "text-gray" },
} satisfies Record<DeltaTone, { Icon: typeof ArrowUpIcon; tone: string }>;

const CHEVRON =
  "size-4 shrink-0 text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-foreground";

/** The name, which opens the profile. */
export function PartnerName({
  member,
  isMe,
  onOpen,
}: {
  member: TeamMember;
  isMe: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir perfil de ${member.name}`}
      className="group -mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-3 rounded-[14px] px-2 text-left outline-none hover:bg-fill-2 focus-visible:bg-fill-2"
    >
      <Avatar neutral name={member.name} src={member.avatar} size={44} />
      <span className="min-w-0 flex-1 truncate text-lg font-semibold">
        {member.name}
        {isMe ? <span className="font-normal text-muted-foreground"> · você</span> : null}
      </span>
      <ChevronRightIcon aria-hidden className={CHEVRON} />
    </button>
  );
}

/** One partner: name (opens the profile), deals and revenue in the period, then "Hoje". */
export function PartnerColumn({
  member,
  isMe,
  period,
  today,
  onOpen,
}: {
  member: TeamMember;
  isMe: boolean;
  period: OverviewPeriod;
  today: string;
  onOpen: () => void;
}) {
  const delta = dealsDelta(member.won.deals, member.previousDeals, period, today);
  const { Icon, tone } = DELTA[delta.tone];
  return (
    <div className="min-w-0">
      <PartnerName member={member} isMe={isMe} onOpen={onOpen} />
      <Link
        {...teamLinks.won(member.id)}
        aria-label={`Abrir em Leads os fechados de ${member.name}`}
        className="group -mx-2 mt-3 flex items-center gap-2 rounded-[10px] px-2 py-1 outline-none hover:bg-fill-2 focus-visible:bg-fill-2"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
          <span className="text-[32px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
            {member.won.deals}
          </span>
          <span className="text-base text-muted-foreground">
            {dealsWord(member.won.deals)} ·{" "}
            <span className="font-semibold text-foreground">
              {formatCents(member.won.revenueCents)}
            </span>
          </span>
        </span>
        <ChevronRightIcon aria-hidden className={CHEVRON} />
      </Link>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon aria-hidden className={cn("size-[15px] shrink-0", tone)} />
        {delta.text}
      </p>
      <PartnerToday lines={todayLines(member, today)} />
    </div>
  );
}
