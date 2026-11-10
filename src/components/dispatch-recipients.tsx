import { Avatar } from "@/components/apple-ui";
import { Badge } from "@/components/ui/badge";

export type DispatchRecipient = { id: string; name: string; email: string | null };

/** The leads of a dispatch review, each with whether its e-mail is already written. */
export function DispatchRecipients({
  recipients,
  draftLeadIds,
  skippedLeadIds,
}: {
  recipients: DispatchRecipient[];
  draftLeadIds: ReadonlySet<string>;
  skippedLeadIds: ReadonlySet<string>;
}) {
  if (recipients.length === 0) return null;
  return (
    <section aria-label="Destinatários" className="grid gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Destinatários ({recipients.length})
      </h3>
      <ul className="grouped">
        {recipients.map((recipient) => (
          <li
            key={recipient.id}
            className="grouped-row flex min-h-[46px] items-center gap-3 px-4 [--inset:16px]"
          >
            <Avatar name={recipient.name} size={24} />
            <div className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">{recipient.name}</span>
              <span className="truncate text-[13px] font-light text-muted-foreground">
                {recipient.email ?? "Sem e-mail"}
              </span>
            </div>
            <RecipientState
              hasDraft={draftLeadIds.has(recipient.id)}
              skipped={skippedLeadIds.has(recipient.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecipientState({ hasDraft, skipped }: { hasDraft: boolean; skipped: boolean }) {
  if (hasDraft) return <Badge variant="green">E-mail escrito</Badge>;
  if (skipped) return <Badge variant="orange">De fora</Badge>;
  return <Badge variant="gray">Falta escrever</Badge>;
}
