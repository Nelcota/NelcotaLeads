import { CircleAlertIcon, LinkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvites } from "@/hooks/use-invites";
import { INVITE_EMAILS_OFF } from "@/lib/team";
import { cn } from "@/lib/utils";
import type { Team } from "@/server/team";
import { InviteRow } from "./invite-row";

/**
 * The invite form, the "e-mail off" line with "Copiar link", and the pending invites.
 * `showEmptyPending` says "Nenhum convite pendente" when there is none; the Convites card
 * leaves it out, since its title already reads "0 pendentes".
 */
export function InvitePanel({
  invites,
  emailsEnabled,
  today,
  showEmptyPending = false,
}: {
  invites: Team["invites"];
  emailsEnabled: boolean;
  today: string;
  showEmptyPending?: boolean;
}) {
  const showPending = invites.length > 0 || showEmptyPending;
  const team = useInvites();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    team.submitInvite();
  };
  return (
    <>
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
      {showPending ? (
        <p className="pt-5 pb-0.5 text-sm font-semibold text-tertiary">Pendentes</p>
      ) : null}
      {invites.length === 0 && showPending ? (
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
    </>
  );
}
