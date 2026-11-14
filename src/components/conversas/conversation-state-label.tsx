import {
  CircleCheckIcon,
  ClockIcon,
  HandIcon,
  SparklesIcon,
  type IconComponent,
} from "@/components/icons";
import type { Tone } from "@/components/apple-ui";
import { StatusLabel } from "@/components/status-label";
import type { ConversationState } from "@/server/mail";

const STATE_LABEL: Record<ConversationState, { label: string; tone: Tone; icon: IconComponent }> = {
  needsYou: { label: "Precisa de você", tone: "orange", icon: HandIcon },
  aiTalking: { label: "IA conversando", tone: "purple", icon: SparklesIcon },
  waiting: { label: "Sem resposta", tone: "gray", icon: ClockIcon },
  closed: { label: "Encerrada", tone: "gray", icon: CircleCheckIcon },
};

/** Where a conversation stands, in the badge standard: a line icon in its color plus text. */
export function ConversationStateLabel({ state }: { state: ConversationState }) {
  const { label, tone, icon } = STATE_LABEL[state];
  return (
    <StatusLabel icon={icon} tone={tone}>
      {label}
    </StatusLabel>
  );
}
