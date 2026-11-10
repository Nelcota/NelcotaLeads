import { HandIcon } from "lucide-react";

/**
 * The AI stopped and handed the conversation to the team. "Devolver para a IA" lives in the
 * conversation header, so this notice only explains (one control per action on screen).
 */
export function HandoffNotice({ reason }: { reason: string | null }) {
  const title = reason ? `A IA parou: ${reason}` : "A IA passou a conversa para você.";
  return (
    <div className="flex max-w-[68ch] flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-border text-orange">
        <HandIcon aria-hidden className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-muted-foreground">
          A conversa é sua. Responda abaixo ou devolva para a IA.
        </p>
      </div>
    </div>
  );
}
