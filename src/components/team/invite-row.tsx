import { LinkIcon, SendIcon, XIcon } from "@/components/icons";
import { Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { dayDiff, localDay, relativeDay } from "@/lib/format";
import type { Team } from "@/server/team";

type Invite = Team["invites"][number];

/** After this many days a pending invite shows its age in orange; the link keeps working. */
const STALE_INVITE_DAYS = 7;

/** "Convite criado ontem", or "há 9 dias" in orange once it is older than a week. */
function InviteAge({ createdAt, today }: { createdAt: Date; today: string }) {
  const day = localDay(createdAt);
  const age = dayDiff(day, today);
  if (age <= STALE_INVITE_DAYS) {
    return (
      <p className="text-sm text-muted-foreground">Convite criado {relativeDay(day, today)}</p>
    );
  }
  return <p className="text-sm text-orange">Convite criado há {age} dias, ainda sem conta</p>;
}

/** A pending invite: its address, its age, "Copiar link", "Reenviar" (e-mails on) and remove. */
export function InviteRow({
  invite,
  today,
  emailsEnabled,
  busy,
  onCopy,
  onResend,
  onRemove,
}: {
  invite: Invite;
  today: string;
  emailsEnabled: boolean;
  busy: boolean;
  onCopy: () => void;
  onResend: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex min-h-13 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/60 py-1.5 last:border-b-0">
      <div className="min-w-0 flex-[1_1_180px]">
        <p className="truncate font-semibold">{invite.email}</p>
        <InviteAge createdAt={invite.createdAt} today={today} />
      </div>
      <Button variant="outline" size="sm" onClick={onCopy}>
        <LinkIcon aria-hidden />
        Copiar link
      </Button>
      {emailsEnabled ? (
        <Button variant="outline" size="sm" onClick={onResend} disabled={busy}>
          <SendIcon aria-hidden />
          Reenviar
        </Button>
      ) : null}
      <Hint label="Remover convite">
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remover convite de ${invite.email}`}
        >
          <XIcon aria-hidden />
        </Button>
      </Hint>
    </div>
  );
}
