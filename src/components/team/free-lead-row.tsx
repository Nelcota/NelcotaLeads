import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { Avatar } from "@/components/apple-ui";
import { StageLabel } from "@/components/leads/stage-label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { freeLeadInfo } from "@/lib/free-lead";
import { teamLinks } from "@/lib/team-links";
import type { Team, TeamMember } from "@/server/team";

type FreeLead = Team["free"]["leads"][number];

/** A free lead: its name opens it, "Pegar" takes it, "Entregar a" gives it to another partner. */
export function FreeLeadRow({
  lead,
  me,
  others,
  now,
  busy,
  onAssign,
}: {
  lead: FreeLead;
  me: TeamMember | null;
  others: TeamMember[];
  now: Date;
  busy: boolean;
  onAssign: (member: TeamMember) => void;
}) {
  return (
    // The name keeps at least 15rem: on a narrow card the buttons wrap below it instead of
    // squeezing it to "Pad…", aligned right (on a phone, under the name). Buttons grow to 44px
    // on touch screens.
    <div className="flex min-h-15 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/60 py-2 last:border-b-0">
      <div className="flex min-w-[min(100%,15rem)] flex-1 items-center gap-3">
        <span
          aria-hidden
          className="size-9 shrink-0 rounded-full border-[1.5px] border-dashed border-border"
        />
        <div className="min-w-0 flex-1">
          <Link
            {...teamLinks.lead(lead.id)}
            className="block truncate py-0.5 text-lg font-semibold hover:underline pointer-coarse:py-2"
          >
            {lead.name}
          </Link>
          <p className="flex flex-wrap items-center gap-x-2.5 text-sm text-muted-foreground">
            <StageLabel stage={lead.status} className="font-normal text-muted-foreground" />
            <span>{freeLeadInfo(lead, now)}</span>
          </p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 max-sm:ml-0 max-sm:pl-12">
        {me ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onAssign(me)}
            className="pointer-coarse:h-11"
          >
            Pegar
          </Button>
        ) : null}
        {others.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy} className="pointer-coarse:h-11">
                Entregar a
                <ChevronDownIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {others.map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  onSelect={() => onAssign(member)}
                  className="min-h-11 gap-2.5 text-base"
                >
                  <Avatar neutral name={member.name} src={member.avatar} size={28} />
                  <span className="flex-1 truncate">{member.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {member.held} ativos
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
