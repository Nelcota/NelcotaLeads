import {
  CalendarDaysIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleXIcon,
  FileTextIcon,
  MailCheckIcon,
  MessageCircleIcon,
  type IconComponent,
} from "@/components/icons";
import { STAGE_COLORS, STAGE_LABELS, type LeadStage } from "@/lib/lead-row";
import { cn } from "@/lib/utils";

const STAGE_ICONS: Record<LeadStage, IconComponent> = {
  new: CircleDotIcon,
  contacted: MailCheckIcon,
  replied: MessageCircleIcon,
  meeting: CalendarDaysIcon,
  proposal: FileTextIcon,
  closed: CircleCheckIcon,
  discarded: CircleXIcon,
};

/** A stage as the badge standard draws it: a line icon in the stage color, then neutral text. */
export function StageLabel({ stage, className }: { stage: LeadStage; className?: string }) {
  const Icon = STAGE_ICONS[stage];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-medium text-foreground", className)}>
      <Icon className="size-3.5 shrink-0" style={{ color: STAGE_COLORS[stage] }} />
      {STAGE_LABELS[stage]}
    </span>
  );
}
