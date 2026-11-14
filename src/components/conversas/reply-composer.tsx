import { CircleAlertIcon, SendIcon, SparklesIcon } from "@/components/icons";
import type { ComponentProps, Ref } from "react";
import { Hint } from "@/components/apple-ui";
import { QuickReplyPicker } from "@/components/quick-reply-picker";
import { StatusLabel } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

type ComposerAction = { label: string; disabled: boolean; onClick: () => void };

/**
 * The reply field: who it goes to and the draft state on top, the text in the middle (one line
 * that grows as you type), the tools and "Enviar" at the bottom. A hairline border that turns blue on focus.
 */
export function ReplyComposer({
  email,
  aiDraft,
  note,
  noteIsError,
  textareaRef,
  textarea,
  quickReply,
  write,
  send,
}: {
  email: string;
  /** The text in the field is the AI's, waiting for the team to review it. */
  aiDraft: boolean;
  /** "Rascunho salvo", "Salvando…" or the signature hint. */
  note: string;
  noteIsError: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  textarea: Omit<ComponentProps<"textarea">, "className" | "rows">;
  quickReply: { disabled: boolean; onPick: (snippet: string) => void };
  write: ComposerAction;
  /** `blockedReason` shows next to "Enviar" when the user must act before sending. */
  send: ComposerAction & { pending: boolean; blockedReason: string | null };
}) {
  return (
    <div className="rounded-[18px] border border-border/70 bg-background transition-[border-color] duration-150 focus-within:border-blue">
      <div className="flex min-w-0 items-center gap-2 px-4 pt-2.5 text-sm text-muted-foreground">
        Para
        <span className="min-w-0 truncate rounded-full bg-fill-2 px-2.5 py-0.5 text-xs font-medium text-foreground">
          {email}
        </span>
        <span className="ml-auto shrink-0" aria-live="polite">
          {aiDraft ? (
            <StatusLabel icon={SparklesIcon} tone="purple">
              Rascunho da IA para revisar
            </StatusLabel>
          ) : (
            <span className={cn("text-xs", noteIsError ? "text-red" : "text-tertiary")}>
              {note}
            </span>
          )}
        </span>
      </div>
      <Textarea
        ref={textareaRef}
        rows={1}
        className="max-h-[220px] min-h-11 resize-none overflow-y-auto rounded-none bg-transparent! px-4 py-1.5 text-base leading-[1.6] shadow-none! focus-visible:shadow-none! focus-visible:ring-0 focus-visible:outline-none"
        {...textarea}
      />
      <div className="flex flex-wrap items-center gap-2 px-2.5 pt-1 pb-2.5">
        <QuickReplyPicker disabled={quickReply.disabled} onPick={quickReply.onPick} />
        <Button variant="outline" size="sm" disabled={write.disabled} onClick={write.onClick}>
          <SparklesIcon aria-hidden className="text-purple" />
          {write.label}
        </Button>
        <span className="ml-auto flex min-w-0 items-center gap-3">
          {send.blockedReason ? (
            <StatusLabel icon={CircleAlertIcon} tone="orange" className="whitespace-normal">
              {send.blockedReason}
            </StatusLabel>
          ) : null}
          <Hint label={`Enviar ${sendShortcut()}`}>
            <Button size="sm" disabled={send.disabled} onClick={send.onClick}>
              <SendIcon aria-hidden />
              {send.pending ? "Enviando…" : send.label}
            </Button>
          </Hint>
        </span>
      </div>
    </div>
  );
}
