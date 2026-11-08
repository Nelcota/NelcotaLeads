import { CircleAlertIcon, ClockIcon, MailIcon, SparklesIcon } from "lucide-react";
import { useId, useState } from "react";
import { Avatar } from "@/components/apple-ui";
import { StatusLabel } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import type { Email } from "@/db/schema";
import { failedEmailAction } from "@/lib/email-errors";
import { localTime, shortTime } from "@/lib/format";
import { splitQuoted } from "@/lib/mail/quoted";
import { cn } from "@/lib/utils";

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

type FailedNext = ReturnType<typeof failedEmailAction>;

/** The company's mark beside its own bubbles: the solid blue "N" of the Nelcota logo. */
function CompanyMark() {
  return (
    <span
      aria-hidden
      className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground"
    >
      N
    </span>
  );
}

function authorOf(message: Email, leadName: string): string {
  if (message.direction === "in") return leadName;
  if (message.author === "ai") return "Nelcota · IA, em seu nome";
  return "Nelcota · Você";
}

/** The right side of the bubble header: the time, the queue or the failure. */
function MessageStatus({ message, next }: { message: Email; next: FailedNext | null }) {
  if (message.status === "failed" && next !== "retried") {
    return (
      <StatusLabel icon={CircleAlertIcon} tone="red">
        Não enviado
      </StatusLabel>
    );
  }
  if (message.status === "failed") {
    return <span className="text-[13px] text-muted-foreground">Não enviado, reenviado</span>;
  }
  if (message.status === "queued") {
    const label = message.sentAt
      ? "Saindo agora"
      : message.sendAfter
        ? `Na fila, sai ${shortTime(message.sendAfter)}`
        : "Na fila";
    return (
      <StatusLabel icon={ClockIcon} tone="orange">
        {label}
      </StatusLabel>
    );
  }
  if (message.status === "cancelled") {
    return (
      <span className="text-[13px] text-muted-foreground">{message.error ?? "Cancelado"}</span>
    );
  }
  return (
    <span className="text-[13px] text-tertiary tabular-nums">
      {message.sentAt ? localTime(message.sentAt) : ""}
    </span>
  );
}

/** Retry, edit or cancel: the actions a bubble offers while its e-mail has not gone out. */
function MessageButtons({
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

/** The original a reply quotes, hidden until asked. */
function QuotedText({ quoted }: { quoted: string }) {
  const [open, setOpen] = useState(false);
  const quotedId = useId();
  return (
    <div className="grid justify-items-start">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? quotedId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Ocultar" : "Mostrar mensagem anterior"}
      </Button>
      {open ? (
        <p
          id={quotedId}
          className="mt-1 border-l-2 border-border pl-3 text-sm leading-relaxed whitespace-pre-line wrap-break-word text-muted-foreground"
        >
          {quoted}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One e-mail as a chat bubble: the company's on the right with a blue border and the "N" mark,
 * the client's on the left in a lighter solid surface. No colored fill, no shadow.
 */
export function MessageBubble({
  message,
  leadName,
  actions,
}: {
  message: Email;
  leadName: string;
  actions: MessageActions;
}) {
  const out = message.direction === "out";
  const failed = message.status === "failed";
  const next = failed ? failedEmailAction(message, actions.today) : null;
  const alarming = failed && next !== "retried";
  // What we sent is shown whole; a reply hides the original it quotes until asked.
  const { visible, quoted } = out
    ? { visible: message.body, quoted: null }
    : splitQuoted(message.body);
  return (
    <div className={cn("flex items-end gap-2.5", out && "justify-end")}>
      {out ? null : <Avatar name={leadName} size={30} />}
      <article
        aria-label={out ? "Mensagem enviada pela Nelcota" : `Mensagem de ${leadName}`}
        className={cn(
          "grid max-w-[min(80%,68ch)] min-w-0 gap-2 rounded-[18px] border px-4 py-3.5",
          out ? "rounded-br-md border-blue/50 bg-card" : "rounded-bl-md border-border bg-card-2",
          alarming && "border-red/60",
          message.status === "cancelled" && "opacity-70",
        )}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {out && message.author === "ai" ? (
            <SparklesIcon aria-hidden className="size-3.5 text-purple" />
          ) : null}
          {out && message.author !== "ai" ? (
            <MailIcon aria-hidden className="size-3.5 text-blue" />
          ) : null}
          <span className="text-sm font-semibold">{authorOf(message, leadName)}</span>
          <span className="ml-auto">
            <MessageStatus message={message} next={next} />
          </span>
        </header>
        <p className="text-base leading-[1.6] whitespace-pre-line wrap-break-word text-foreground">
          {visible}
        </p>
        {alarming && message.error ? (
          <p className="text-[13px] text-muted-foreground">{message.error}</p>
        ) : null}
        <MessageButtons message={message} next={next} actions={actions} />
        {quoted ? <QuotedText quoted={quoted} /> : null}
      </article>
      {out ? <CompanyMark /> : null}
    </div>
  );
}
