import { useEffect, useRef } from "react";
import { Avatar } from "@/components/apple-ui";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { localDay } from "@/lib/format";
import { formatCents } from "@/lib/money";
import { PERIOD_CAPTIONS, type OverviewPeriod } from "@/lib/period";
import type { ActivityLine } from "@/lib/team-activity";
import { todayLines } from "@/lib/team-member";
import type { Team, TeamMember } from "@/server/team";
import { PartnerLeads } from "./partner-leads";
import { PartnerTiles } from "./partner-tiles";
import { PartnerToday } from "./partner-today";

/** The visible button that opened a partner's profile (the column on a wide screen, the row on a phone). */
function profileOpener(memberId: string | null): HTMLElement | null {
  if (!memberId) return null;
  const buttons = document.querySelectorAll<HTMLElement>("[data-partner-open]");
  return (
    Array.from(buttons).find(
      (button) => button.dataset.partnerOpen === memberId && button.offsetParent !== null,
    ) ?? null
  );
}

function ratio(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

function Numbers({ member, goalCents }: { member: TeamMember; goalCents: number }) {
  const ticket =
    member.won.deals > 0
      ? formatCents(Math.round(member.won.revenueCents / member.won.deals))
      : "—";
  return (
    <>
      <PartnerTiles member={member} />
      <dl className="mt-3 text-base">
        {[
          ["Propostas que fecharam", ratio(member.won.deals, member.proposals)],
          ["Ticket médio", ticket],
          ["% da meta de receita", ratio(member.month.revenueCents, goalCents)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex min-h-12 items-center justify-between border-t border-border/60"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-6">
      <h3 className="flex items-baseline gap-2 pb-2 text-[20px] font-semibold tracking-[-0.015em]">
        {title}
        {aside ? <span className="text-sm font-normal text-tertiary">{aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/** A partner's profile beside the page: numbers, today, open leads and recent activity. */
export function PartnerSheet({
  member,
  isMe,
  team,
  activity,
  period,
  onClose,
}: {
  member: TeamMember | null;
  isMe: boolean;
  team: Team;
  activity: ActivityLine[];
  period: OverviewPeriod;
  onClose: () => void;
}) {
  // The sheet opens from the URL (?socio=), so Radix has no trigger to give focus back to: on
  // close it returns to the partner's button instead of the page body.
  const lastOpened = useRef<string | null>(null);
  useEffect(() => {
    if (member) lastOpened.current = member.id;
  }, [member]);
  const returnFocus = (event: Event) => {
    const opener = profileOpener(lastOpened.current);
    if (!opener) return;
    event.preventDefault();
    opener.focus();
  };
  const since = member ? localDay(member.since) : "";
  const recent = member ? activity.filter((line) => line.whoId === member.id).slice(0, 3) : [];
  return (
    <Sheet open={member !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent
        onCloseAutoFocus={returnFocus}
        className="w-full gap-0 overflow-y-auto p-6 data-[side=right]:sm:max-w-[460px]"
      >
        {member ? (
          <>
            <div className="flex items-start gap-3.5 pr-8">
              <Avatar neutral name={member.name} src={member.avatar} size={64} />
              <div className="min-w-0">
                <SheetTitle className="text-2xl font-semibold">
                  {member.name}
                  {isMe ? (
                    <span className="text-lg font-normal text-muted-foreground"> · você</span>
                  ) : null}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {member.email} · na equipe desde {since.slice(8, 10)}/{since.slice(5, 7)}/
                  {since.slice(0, 4)}
                </SheetDescription>
              </div>
            </div>
            <Section title="Números" aside={PERIOD_CAPTIONS[period]}>
              <Numbers member={member} goalCents={team.goal.goal?.revenueCents ?? 0} />
            </Section>
            <PartnerToday lines={todayLines(member, team.today, isMe)} />
            <Section title="Em andamento">
              <PartnerLeads memberId={member.id} held={member.held} today={team.today} />
            </Section>
            <Section title="Atividade recente">
              {recent.length === 0 ? (
                <p className="text-base text-muted-foreground">Nada nesse período.</p>
              ) : (
                recent.map((line) => (
                  <p
                    key={line.id}
                    className="flex min-h-11 items-start justify-between gap-3 py-1.5 text-base"
                  >
                    <span>
                      {line.verb.charAt(0).toUpperCase() + line.verb.slice(1)}{" "}
                      <span className="font-semibold">{line.leadName}</span>
                      {line.extra ? (
                        <span className="block text-sm text-muted-foreground">{line.extra}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm text-tertiary">{line.when}</span>
                  </p>
                ))
              )}
            </Section>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
