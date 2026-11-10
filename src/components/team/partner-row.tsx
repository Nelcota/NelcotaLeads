import { ChevronRightIcon } from "lucide-react";
import { Fragment } from "react";
import { Avatar } from "@/components/apple-ui";
import { formatCents } from "@/lib/money";
import { dealsWord, todaySummary } from "@/lib/team-member";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/server/team";

/** A partner on a phone: one row with deals, revenue and today in a line; it opens the profile. */
export function PartnerRow({
  member,
  isMe,
  onOpen,
}: {
  member: TeamMember;
  isMe: boolean;
  onOpen: () => void;
}) {
  const parts = todaySummary(member);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir perfil de ${member.name}`}
      className="group -mx-2 flex min-h-[72px] w-[calc(100%+16px)] items-center gap-3 rounded-[14px] border-b border-border/60 px-2 py-2.5 text-left outline-none last:border-b-0 hover:bg-fill-2 focus-visible:bg-fill-2"
    >
      <Avatar neutral name={member.name} src={member.avatar} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-semibold">
          {member.name}
          {isMe ? <span className="font-normal text-muted-foreground"> · você</span> : null}
        </span>
        <span className="block text-sm text-muted-foreground tabular-nums">
          {member.won.deals} {dealsWord(member.won.deals)} · {formatCents(member.won.revenueCents)}
        </span>
        <span className="block text-sm">
          {parts.map((part, index) => (
            <Fragment key={part.text}>
              {index > 0 ? " · " : null}
              <span className={cn(part.late && "text-red")}>{part.text}</span>
            </Fragment>
          ))}
        </span>
      </span>
      <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-tertiary" />
    </button>
  );
}
