import { Link } from "@tanstack/react-router";
import { formatCents } from "@/lib/money";
import { teamLinks, type TeamLink } from "@/lib/team-links";
import type { TeamMember } from "@/server/team";

type Tile = { label: string; value: string; link: TeamLink; aria: string };

function tilesOf(member: TeamMember): Tile[] {
  const name = member.name;
  return [
    {
      label: "Leads ativos",
      value: String(member.held),
      link: teamLinks.held(member.id),
      aria: `${member.held} leads ativos de ${name}: abrir em Leads`,
    },
    {
      label: "Em conversa",
      value: String(member.talking),
      link: teamLinks.talking(member.id),
      aria: `${member.talking} em conversa: abrir em Leads`,
    },
    {
      label: "Reuniões",
      value: String(member.meetings),
      link: teamLinks.meetings(member.id),
      aria: `${member.meetings} reuniões: abrir na Agenda de ${name}`,
    },
    {
      label: "Propostas",
      value: String(member.proposals),
      link: teamLinks.proposals(member.id),
      aria: `${member.proposals} propostas: abrir em Leads`,
    },
    {
      label: "Fechados",
      value: String(member.won.deals),
      link: teamLinks.won(member.id),
      aria: `${member.won.deals} fechados: abrir em Leads`,
    },
    {
      label: "Receita",
      value: formatCents(member.won.revenueCents),
      link: teamLinks.won(member.id),
      aria: `Receita de ${formatCents(member.won.revenueCents)}: abrir os fechados em Leads`,
    },
  ];
}

/**
 * The profile's six numbers; each opens the matching list, already filtered by the partner.
 * `pipelineOnly` keeps the first four (leads, conversations, meetings, proposals) in two columns,
 * for a card that already shows deals and revenue as its big number.
 */
export function PartnerTiles({
  member,
  pipelineOnly = false,
}: {
  member: TeamMember;
  pipelineOnly?: boolean;
}) {
  const tiles = pipelineOnly ? tilesOf(member).slice(0, 4) : tilesOf(member);
  return (
    <div className={pipelineOnly ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-3 gap-2.5"}>
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          {...tile.link}
          aria-label={tile.aria}
          className="block rounded-[14px] bg-card-2 px-3.5 py-3 outline-none hover:shadow-[inset_0_0_0_1px_var(--border)] focus-visible:shadow-[inset_0_0_0_1px_var(--border)]"
        >
          <span className="block text-sm text-muted-foreground">{tile.label}</span>
          <span className="mt-0.5 block truncate text-xl leading-tight font-semibold tabular-nums">
            {tile.value}
          </span>
        </Link>
      ))}
    </div>
  );
}
