import { CircleCheckIcon, PencilLineIcon, UsersIcon } from "@/components/icons";
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
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <UsersIcon aria-hidden className="size-4 shrink-0 text-blue" />
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
              <span className="truncate text-xs text-muted-foreground">
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
  if (hasDraft) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-green">
        <CircleCheckIcon aria-hidden className="size-3.5 shrink-0" />
        E-mail escrito
      </span>
    );
  }
  if (skipped) return <Badge variant="orange">De fora</Badge>;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <PencilLineIcon aria-hidden className="size-3.5 shrink-0" />
      Falta escrever
    </span>
  );
}
