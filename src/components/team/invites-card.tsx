import { CircleAlertIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvites } from "@/hooks/use-invites";
import { INVITE_EMAILS_OFF } from "@/lib/team";
import { cn } from "@/lib/utils";
import type { Team } from "@/server/team";
import { InviteRow } from "./invite-row";
import { PhoneFold } from "./phone-fold";

/** The phone's closed line: "1 convite pendente" or "Convidar um sócio". */
function invitesSummary(pending: number): string {
  if (pending === 0) return "Convidar um sócio";
  return `${pending} ${pending === 1 ? "convite pendente" : "convites pendentes"}`;
}

/** "Convites": invite by e-mail and the pending ones, each with its link. */
export function InvitesCard({
  invites,
  emailsEnabled,
  today,
}: {
  invites: Team["invites"];
  emailsEnabled: boolean;
  today: string;
}) {
  const team = useInvites();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    team.submitInvite();
  };
  return (
    <section
      className="grouped enter p-5 sm:p-6"
      style={{ animationDelay: "180ms" }}
      aria-labelledby="team-invites"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <h2 id="team-invites" className="text-[20px] font-semibold tracking-[-0.015em]">
          Convites
        </h2>
        <span className="text-sm text-tertiary">
          {invites.length} {invites.length === 1 ? "pendente" : "pendentes"}
        </span>
      </div>
      <PhoneFold summary={invitesSummary(invites.length)}>
        <form className="grid gap-2 pt-4" onSubmit={submit} noValidate>
          <Label htmlFor="invite-email" className="text-sm font-semibold">
            E-mail do sócio
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              key={team.errorCount}
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="nome@empresa.com"
              className={cn("h-11 min-w-0 flex-[1_1_220px] text-base", team.error && "shake")}
              value={team.email}
              aria-invalid={team.error ? true : undefined}
              aria-describedby={team.error ? "invite-error" : undefined}
              onChange={(event) => team.changeEmail(event.target.value)}
            />
            <Button type="submit" size="lg" disabled={team.inviting}>
              {team.inviting ? "Convidando…" : "Convidar"}
            </Button>
          </div>
          {team.error ? (
            <p id="invite-error" role="alert" className="text-sm text-red">
              {team.error}
            </p>
          ) : null}
        </form>
        {emailsEnabled ? null : (
          <div className="flex flex-wrap items-center gap-2 pt-3 text-sm text-muted-foreground">
            <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-orange" />
            <span className="flex-1">{INVITE_EMAILS_OFF}</span>
            <Button variant="outline" size="sm" onClick={team.copyLink}>
              <LinkIcon aria-hidden />
              Copiar link
            </Button>
          </div>
        )}
        <p className="pt-5 pb-0.5 text-sm font-semibold text-tertiary">Pendentes</p>
        {invites.length === 0 ? (
          <p className="flex min-h-11 items-center text-base text-muted-foreground">
            Nenhum convite pendente.
          </p>
        ) : (
          invites.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              today={today}
              emailsEnabled={emailsEnabled}
              busy={team.removingId === invite.id || team.resendingId === invite.id}
              onCopy={team.copyLink}
              onResend={() => team.resendInvite(invite.id)}
              onRemove={() => team.removeInvite(invite.id)}
            />
          ))
        )}
      </PhoneFold>
    </section>
  );
}
