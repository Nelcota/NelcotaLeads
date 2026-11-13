import {
  CircleCheckIcon,
  CircleMinusIcon,
  CircleXIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import type { JobState } from "@/lib/system-status";
import { cn } from "@/lib/utils";

const ICON: Record<JobState, LucideIcon> = {
  ok: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleXIcon,
  off: CircleMinusIcon,
};

const COLOR: Record<JobState, string> = {
  ok: "text-green",
  warning: "text-orange",
  error: "text-red",
  off: "text-muted-foreground",
};

export const JOB_STATE_LABEL: Record<JobState, string> = {
  ok: "Funcionando",
  warning: "Atenção",
  error: "Falhando",
  off: "Desligado",
};

/** A task's state as a line icon in its color (the badge standard), named for screen readers. */
export function JobStateIcon({ state, className }: { state: JobState; className?: string }) {
  const Icon = ICON[state];
  return (
    <Icon
      role="img"
      aria-label={JOB_STATE_LABEL[state]}
      className={cn("size-[18px] shrink-0", COLOR[state], className)}
    />
  );
}
