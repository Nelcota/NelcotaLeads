import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CircleCheckIcon, ShuffleIcon } from "@/components/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLeadAssign } from "@/hooks/use-lead-assign";
import { teamLinks } from "@/lib/team-links";
import type { Team, TeamMember } from "@/server/team";
import { FreeLeadRow } from "./free-lead-row";
import { SplitConfirm } from "./split-confirm";

/** From this many free leads, "Dividir entre os sócios" asks first (the Leads page's bulk rule). */
const CONFIRM_FROM = 3;

/**
 * "Leads sem dono": contacted or replied leads nobody took, with "Pegar", "Entregar a" and
 * "Dividir entre os sócios"; new ones only show as a count (they go through the dispatch).
 */
export function FreeLeads({
  free,
  members,
  me,
  now,
}: {
  free: Team["free"];
  members: TeamMember[];
  me: string | null;
  now: Date;
}) {
  const self = members.find((member) => member.id === me) ?? null;
  const others = members.filter((member) => member.id !== me);
  const { assign, assigningId, split, splitting } = useLeadAssign();
  const [confirming, setConfirming] = useState(false);
  const askSplit = () => {
    if (free.total < CONFIRM_FROM) {
      split();
      return;
    }
    setConfirming((open) => !open);
  };
  const confirmSplit = () => split(() => setConfirming(false));

  return (
    <section
      className="grouped enter p-5 sm:p-6"
      style={{ animationDelay: "100ms" }}
      aria-labelledby="team-free"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <h2 id="team-free" className="text-[20px] font-semibold tracking-[-0.015em]">
          Leads sem dono
        </h2>
        <span className="text-sm text-tertiary tabular-nums">{free.total}</span>
        {free.total > 0 && members.length > 1 ? (
          <Button
            size="sm"
            className="ml-auto pointer-coarse:h-11"
            onClick={askSplit}
            disabled={splitting}
            aria-expanded={confirming}
          >
            <ShuffleIcon aria-hidden />
            Dividir entre os sócios
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <SplitConfirm
          count={free.total}
          members={members}
          busy={splitting}
          onConfirm={confirmSplit}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
      {free.total === 0 ? (
        <p className="flex min-h-13 items-center gap-2.5 pt-2 text-base text-muted-foreground">
          <CircleCheckIcon aria-hidden className="size-5 text-green" />
          Toda conversa tem dono.
        </p>
      ) : (
        <div className="pt-1">
          {free.leads.map((lead) => (
            <FreeLeadRow
              key={lead.id}
              lead={lead}
              me={self}
              others={others}
              now={now}
              busy={assigningId === lead.id || splitting}
              onAssign={(member) =>
                assign({
                  leadId: lead.id,
                  ownerId: member.id,
                  leadName: lead.name,
                  ownerName: member.name,
                  self: member.id === me,
                })
              }
            />
          ))}
        </div>
      )}
      {free.total > free.leads.length ? (
        <Link
          {...teamLinks.free()}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-base font-semibold text-blue hover:underline"
        >
          Ver todos sem dono
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
      ) : null}
      {free.newCount > 0 ? (
        <p className="pt-2 text-sm text-muted-foreground">
          Mais {free.newCount} {free.newCount === 1 ? "novo" : "novos"} no disparo.
        </p>
      ) : null}
    </section>
  );
}
