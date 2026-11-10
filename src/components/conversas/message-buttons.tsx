import { Button } from "@/components/ui/button";
import type { Email } from "@/db/schema";
import type { FailedNext } from "./message-status";

export type MessageActions = {
  today: string;
  /** The composer is open, so a queued e-mail can go back to it. */
  canEdit: boolean;
  /** A closed conversation sends nothing; it has to be reopened first. */
  canRetry: boolean;
  busyId: string | undefined;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit: (id: string) => void;
};

/** Retry, edit or cancel: what a bubble offers while its e-mail has not gone out. */
export function MessageButtons({
  message,
  next,
  actions,
}: {
  message: Email;
  next: FailedNext | null;
  actions: MessageActions;
}) {
  const busy = actions.busyId === message.id;
  const pending = actions.busyId !== undefined;
  const waiting = message.status === "queued" && !message.sentAt && message.direction === "out";
  const canRetry = next === "retry" && actions.canRetry;
  if (!canRetry && !waiting && next !== "tomorrow") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {canRetry ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => actions.onRetry(message.id)}
        >
          {busy ? "Reenviando…" : "Tentar de novo"}
        </Button>
      ) : null}
      {next === "tomorrow" ? (
        <span className="text-[13px] text-muted-foreground">O envio tenta de novo amanhã.</span>
      ) : null}
      {waiting && actions.canEdit ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => actions.onEdit(message.id)}
        >
          {busy ? "Abrindo…" : "Editar"}
        </Button>
      ) : null}
      {waiting ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => actions.onCancel(message.id)}
        >
          {busy ? "Cancelando…" : "Cancelar envio"}
        </Button>
      ) : null}
    </div>
  );
}
