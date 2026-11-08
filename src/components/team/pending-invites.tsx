import { MailIcon } from "lucide-react";
import { GroupedRow, IconTile, SectionHeader } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import type { Team } from "@/server/team";

/** Invites nobody used yet, each with "Remover". Hidden when there is none. */
export function PendingInvites({
  invites,
  emailsEnabled,
  removingId,
  onRemove,
}: {
  invites: Team["invites"];
  /** With invite e-mails off, nothing was sent: the person gets the link by hand. */
  emailsEnabled: boolean;
  removingId: string | null;
  onRemove: (id: string) => void;
}) {
  if (invites.length === 0) return null;
  const subtitle = emailsEnabled ? "Convite enviado" : "Aguardando criar conta pelo link";
  return (
    <section className="enter min-w-0">
      <SectionHeader title="Convites pendentes" />
      <div className="grouped">
        {invites.map((invite) => (
          <GroupedRow
            key={invite.id}
            lead={<IconTile icon={MailIcon} tone="blue" size={30} />}
            title={invite.email}
            subtitle={subtitle}
            trailing={
              <Button
                variant="outline"
                size="sm"
                disabled={removingId === invite.id}
                onClick={() => onRemove(invite.id)}
              >
                Remover
              </Button>
            }
          />
        ))}
      </div>
    </section>
  );
}
