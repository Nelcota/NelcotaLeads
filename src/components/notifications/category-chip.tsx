import { CalendarIcon, ClockIcon, HistoryIcon, MailIcon, type LucideIcon } from "lucide-react";
import { toneVar, type Tone } from "@/components/apple-ui";
import type { NotificationCategory } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  replies: MailIcon,
  followUps: ClockIcon,
  agenda: CalendarIcon,
  searches: HistoryIcon,
};

const CATEGORY_TONE: Record<NotificationCategory, Tone> = {
  replies: "blue",
  followUps: "orange",
  agenda: "teal",
  searches: "green",
};

/** The category's line icon on a chip tinted with its color (list-row icon standard). */
export function CategoryChip({
  category,
  size = 34,
  className,
}: {
  category: NotificationCategory;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category];
  const tone = toneVar(CATEGORY_TONE[category]);
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-[10px]", className)}
      style={{
        width: size,
        height: size,
        color: tone,
        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
      }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
    </span>
  );
}
