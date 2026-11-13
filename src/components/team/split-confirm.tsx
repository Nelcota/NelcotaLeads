import { Avatar } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { splitPreview } from "@/lib/team-split";
import type { TeamMember } from "@/server/team";

/** "Dividir N leads entre os sócios?": who gets how many, before anything moves. */
export function SplitConfirm({
  count,
  members,
  busy,
  onConfirm,
  onCancel,
}: {
  count: number;
  members: TeamMember[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const shares = splitPreview(count, members);
  const byId = new Map(members.map((member) => [member.id, member]));
  return (
    <div
      role="group"
      aria-label="Confirmar divisão"
      className="pop mt-4 rounded-2xl border border-border bg-card-2 p-4"
    >
      <p className="text-lg font-semibold">Dividir {count} leads entre os sócios?</p>
      <div className="mt-1">
        {shares.map((share) => {
          const member = byId.get(share.id);
          if (!member) return null;
          return (
            <div key={share.id} className="flex min-h-11 items-center gap-2.5">
              <Avatar neutral name={member.name} src={member.avatar} size={28} />
              <span className="flex-1">
                <span className="font-semibold">{member.name}</span> recebe {share.count}{" "}
                {share.count === 1 ? "lead" : "leads"}
              </span>
              <span className="text-sm text-muted-foreground">fica com {share.after}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={busy}>
          {busy ? "Dividindo…" : "Confirmar divisão"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
