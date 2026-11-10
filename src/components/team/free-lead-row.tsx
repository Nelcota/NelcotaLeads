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
import { localDay, relativeDay } from "@/lib/format";
import { teamLinks } from "@/lib/team-links";
import type { Team, TeamMember } from "@/server/team";

type FreeLead = Team["free"]["leads"][number];

/** "chegou hoje", "e-mail há 3 dias": what matters for who should take it. */
function freeLeadInfo(lead: FreeLead, today: string): string {
  if (lead.status === "new") return `chegou ${relativeDay(localDay(lead.createdAt), today)}`;
  if (!lead.lastEmailAt) return "";
  const when = relativeDay(localDay(lead.lastEmailAt), today);
  return lead.status === "replied" ? `respondeu ${when}` : `e-mail ${when}`;
}

/** A free lead: its name opens it, "Pegar" takes it, "Entregar a" gives it to another partner. */
export function FreeLeadRow({
  lead,
  me,
  others,
  today,
  busy,
  onAssign,
}: {
  lead: FreeLead;
  me: TeamMember | null;
  others: TeamMember[];
  today: string;
  busy: boolean;
  onAssign: (member: TeamMember) => void;
}) {
  return (
    <div className="flex min-h-15 items-center gap-3 border-b border-border/60 py-2 last:border-b-0">
      <span
        aria-hidden
        className="size-9 shrink-0 rounded-full border-[1.5px] border-dashed border-border"
      />
      <div className="min-w-0 flex-1">
        <Link
          {...teamLinks.lead(lead.id)}
          className="block truncate text-[17px] font-semibold hover:underline"
        >
          {lead.name}
        </Link>
        <p className="flex flex-wrap items-center gap-x-2.5 text-sm text-muted-foreground">
          <StageLabel stage={lead.status} className="font-normal text-muted-foreground" />
          <span>{freeLeadInfo(lead, today)}</span>
        </p>
      </div>
      {me ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onAssign(me)}>
          Pegar
        </Button>
      ) : null}
      {others.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
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
  );
}
