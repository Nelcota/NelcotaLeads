import { HandIcon } from "lucide-react";

/**
 * The AI stopped and handed the conversation to the team. "Devolver para a IA" lives in the
 * conversation header, so this notice only explains (one control per action on screen).
 */
export function HandoffNotice({ reason }: { reason: string | null }) {
  const title = reason ? `A IA parou: ${reason}` : "A IA passou a conversa para você.";
  return (
    <div className="flex max-w-[68ch] items-start gap-2 rounded-2xl bg-fill-2 px-4 py-3.5">
      <HandIcon aria-hidden strokeWidth={2} className="mt-px size-[18px] shrink-0 text-orange" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-muted-foreground">
          A conversa é sua. Responda abaixo ou devolva para a IA.
        </p>
      </div>
    </div>
  );
}
