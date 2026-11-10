import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Email } from "@/db/schema";
import { shownMessages, withDayBreaks } from "@/lib/conversation-thread";
import { MessageBubble } from "./message-bubble";
import type { MessageActions } from "./message-buttons";

/** A thin rule with the day in the middle: "Hoje", "Ontem", "Qui, 05/11". */
function DaySeparator({ label }: { label: string }) {
  return (
    <div
      role="separator"
      aria-label={label}
      className="flex items-center gap-3 pt-2 text-[13px] font-medium text-tertiary before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
    >
      {label}
    </div>
  );
}

/**
 * The e-mails of one conversation as chat bubbles, grouped by day. A long thread opens on its
 * newest messages, with a button for the older ones.
 */
export function ThreadMessages({
  messages,
  leadName,
  actions,
}: {
  messages: Email[];
  leadName: string;
  actions: MessageActions;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = shownMessages(messages, expanded);
  const hidden = messages.length - shown.length;
  const canCollapse = expanded && shownMessages(messages, false).length < messages.length;
  return (
    <div className="grid gap-3">
      {hidden > 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-center"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          <ChevronUpIcon aria-hidden />
          Ver {hidden} mensagens anteriores
        </Button>
      ) : null}
      {canCollapse ? (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-center"
          aria-expanded
          onClick={() => setExpanded(false)}
        >
          <ChevronDownIcon aria-hidden />
          Recolher mensagens antigas
        </Button>
      ) : null}
      {withDayBreaks(shown, actions.today).map(({ message, dayBreak }) => (
        <div key={message.id} className="grid gap-3">
          {dayBreak ? <DaySeparator label={dayBreak} /> : null}
          <MessageBubble message={message} leadName={leadName} actions={actions} />
        </div>
      ))}
    </div>
  );
}
