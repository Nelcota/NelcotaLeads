import { BotIcon, HandIcon, SparklesIcon, UserIcon } from "@/components/icons";
import { StatusLabel } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import type { ConversationOwner } from "@/lib/conversation-owner";

/**
 * The header's "who answers" line: the statement in the badge standard and the one control
 * that hands the conversation to the other side.
 */
export function ConversationOwnerControl({
  owner,
  busy,
  onChange,
}: {
  owner: ConversationOwner;
  busy: boolean;
  onChange: (aiMode: boolean) => void;
}) {
  const aiAnswers = owner.answeredBy === "ai";
  return (
    <div className="flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-between">
      <StatusLabel
        icon={aiAnswers ? SparklesIcon : UserIcon}
        tone={aiAnswers ? "purple" : "orange"}
        className="text-sm"
      >
        {owner.label}
      </StatusLabel>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onChange(owner.action.aiMode)}
      >
        {aiAnswers ? <HandIcon aria-hidden /> : <BotIcon aria-hidden className="text-purple" />}
        {owner.action.label}
      </Button>
    </div>
  );
}
