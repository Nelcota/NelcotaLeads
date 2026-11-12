import { CircleAlertIcon, ClockIcon } from "lucide-react";
import { StatusLabel } from "@/components/status-label";
import type { Email } from "@/db/schema";
import type { failedEmailAction } from "@/lib/email-errors";
import { localTime, shortTime } from "@/lib/format";

/** What happens next to an e-mail that failed: retry now, retry tomorrow, or already retried. */
export type FailedNext = ReturnType<typeof failedEmailAction>;

function queueLabel(message: Email): string {
  if (message.sentAt) return "Saindo agora";
  if (message.sendAfter) return `Na fila, sai ${shortTime(message.sendAfter)}`;
  return "Na fila";
}

/** The right side of a bubble header: the time it went out, the queue or the failure. */
export function MessageStatus({ message, next }: { message: Email; next: FailedNext | null }) {
  if (message.status === "failed" && next !== "retried") {
    return (
      <StatusLabel icon={CircleAlertIcon} tone="red">
        Não enviado
      </StatusLabel>
    );
  }
  if (message.status === "failed") {
    return <span className="text-xs text-muted-foreground">Não enviado, reenviado</span>;
  }
  if (message.status === "queued") {
    return (
      <StatusLabel icon={ClockIcon} tone="orange">
        {queueLabel(message)}
      </StatusLabel>
    );
  }
  if (message.status === "cancelled") {
    return <span className="text-xs text-muted-foreground">{message.error ?? "Cancelado"}</span>;
  }
  return (
    <span className="text-xs text-tertiary tabular-nums">
      {message.sentAt ? localTime(message.sentAt) : ""}
    </span>
  );
}
