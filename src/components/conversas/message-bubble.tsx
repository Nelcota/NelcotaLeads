import { MailIcon, SparklesIcon } from "lucide-react";
import { Avatar } from "@/components/apple-ui";
import type { Email } from "@/db/schema";
import { failedEmailAction } from "@/lib/email-errors";
import { splitQuoted } from "@/lib/mail/quoted";
import { cn } from "@/lib/utils";
import { MessageButtons, type MessageActions } from "./message-buttons";
import { MessageStatus } from "./message-status";
import { QuotedText } from "./quoted-text";

/** The company's mark beside its own bubbles: the solid blue "N" of the Nelcota logo. */
function CompanyMark() {
  return (
    <span
      aria-hidden
      className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-primary text-xs font-bold text-primary-foreground"
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

/**
 * One e-mail as a chat bubble: the company's on the right with a blue-tinted fill and the "N" mark,
 * the client's on the left in a neutral fill. No border (except a failed send), no shadow.
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
          "grid max-w-[min(80%,68ch)] min-w-0 gap-2 rounded-[18px] px-4 py-3.5 forced-colors:border",
          out
            ? "rounded-br-md bg-[color-mix(in_srgb,var(--blue)_16%,var(--card))]"
            : "rounded-bl-md bg-bubble-in",
          alarming && "border border-red/60",
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
          <p className="text-xs text-muted-foreground">{message.error}</p>
        ) : null}
        <MessageButtons message={message} next={next} actions={actions} />
        {quoted ? <QuotedText quoted={quoted} /> : null}
      </article>
      {out ? <CompanyMark /> : null}
    </div>
  );
}
